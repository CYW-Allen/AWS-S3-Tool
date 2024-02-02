import fastifyPlugin from "fastify-plugin";
import { randomUUID } from 'crypto';
import dayjs from "dayjs";
import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

export default fastifyPlugin(async function (fastify, opts) {
  function fillListWithItems(list, items) {
    for (let i = 0; i < items.length; i++) list.push(items[i]);
  }

  function getDayList(begin, end) {
    const sNum = Number(begin);
    const eNum = Number(end || begin);
    const st = dayjs(Math.min(sNum, eNum).toString());
    const et = dayjs(Math.max(sNum, eNum).toString()).add(1, 'day');
    const dayList = [];

    for (let ct = st; ct.isBefore(et); ct = ct.add(1, 'day')) {
      dayList.push(Number(ct.format('YYYYMMDD')));
    }
    return dayList;
  }

  function sanitizeFilters(mainObj, filters) {
    const queryField = ['action', 'editor', 'objKey', 'bucket'];

    delete filters[mainObj];
    Object.keys(filters).forEach((key) => {
      if (!queryField.includes(key)) delete filters[key];
    });
  }

  function getQueryConfig(queryCondition) {
    const { TableName, obj, objVal, filters } = queryCondition;
    const expressionConfig = Object.entries(filters || {})
      .reduce((result, [field, val]) => {
        (result.FilterExpression ??= []).push(`#${field} = :v_${field}`);
        (result.ExpressionAttributeNames ??= {})[`#${field}`] = field;
        (result.ExpressionAttributeValues ??= {})[`:v_${field}`] = val;
        return result;
      }, {});

    if (filters) {
      expressionConfig.FilterExpression = expressionConfig.FilterExpression.join(' AND ');
    }
    (expressionConfig.ExpressionAttributeNames ??= {})[`#${obj}`] = obj;
    (expressionConfig.ExpressionAttributeValues ??= {})[`:v_${obj}`] = objVal;
    expressionConfig.ExpressionAttributeNames['#action'] = 'action';
    expressionConfig.ExpressionAttributeNames['#bucket'] = 'bucket';

    return {
      TableName,
      IndexName: `${obj}-index`,
      KeyConditionExpression: `#${obj} = :v_${obj}`,
      ...expressionConfig,
      ProjectionExpression: 'recId,#action,#bucket,createdAt,editor,objKey',
    };
  }

  async function queryHistory(caller, queryConfig) {
    try {
      const dbCmd = new QueryCommand(queryConfig);
      const recs = [];

      do {
        const { Items, LastEvaluatedKey } = await fastify.dbClient.send(dbCmd);

        fillListWithItems(recs, Items || []);
        dbCmd.input.ExclusiveStartKey = LastEvaluatedKey;
      } while (dbCmd.input.ExclusiveStartKey);
      return recs;
    } catch (err) {
      fastify.logStat('error', `${caller}->queryHistory`, err);
      return [];
    }
  }

  async function checkUserExist(username) {
    const user = await fastify.dbClient.send(new GetCommand({
      TableName: fastify.userTable,
      Key: { username },
    }));

    return Boolean(user.Item);
  }

  async function getDelReqItems(TableName, queryCondition, caller) {
    const { obj, objVal, filters } = queryCondition;
    const reqItems = [];
    const failure = [];

    if (obj === 'createdTimeNum') {
      const days = getDayList(...objVal.split('~'));
      const results = (await Promise.allSettled(
        days.map((day) => queryHistory(caller, getQueryConfig({ TableName, obj, objVal: day, filters })))
      ));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const delRequests = result.value.map((row) => ({
            DeleteRequest: {
              Key: { recId: row.recId },
            },
          }));

          fillListWithItems(reqItems, delRequests);
        } else failure.push(`Fail to get history in ${days[index]}`);
      });
    } else {
      const delRequests = (await queryHistory(caller, getQueryConfig({ TableName, obj, objVal, filters })))
        .map((row) => ({
          DeleteRequest: {
            Key: { recId: row.recId },
          },
        }));

      fillListWithItems(reqItems, delRequests);
    }

    return { reqItems, failure };
  }

  fastify.decorate('recordOper', async function (bucket, objKey, action, editor) {
    try {
      await fastify.dbClient.send(new PutCommand({
        TableName: fastify.historyTable,
        Item: {
          recId: randomUUID(),
          bucket,
          objKey,
          createdAt: Date.now(),
          createdTimeNum: Number(dayjs(Date.now() + Number(process.env.UTCOFFSET)).format('YYYYMMDD')),
          action,
          editor,
        },
      }));
      fastify.logStat('info', `${editor}->recordOper`, `User ${editor} success to reocrd s3 operation`);
    } catch (err) {
      fastify.logStat('error', `${editor}->recordOper`, err);
    }
  });

  fastify.decorate('listHistory', async function (req, reply) {
    const caller = req.user.username;
    const bucket = req.query.bucket;
    const recs = [];

    try {
      const dbCmd = new ScanCommand({
        TableName: fastify.historyTable,
        ...(bucket && {
          FilterExpression: '#bucket = :v_bucket',
          ExpressionAttributeNames: { '#bucket': 'bucket' },
          ExpressionAttributeValues: { ':v_bucket': bucket },
        }),
      });

      do {
        const { Items, LastEvaluatedKey } = await fastify.dbClient.send(dbCmd);

        fillListWithItems(recs, Items);
        dbCmd.input.ExclusiveStartKey = LastEvaluatedKey;
      } while (dbCmd.input.ExclusiveStartKey);
      return reply.send({ data: recs });
    } catch (err) {
      fastify.logStat('error', `${caller}->listHistory`, err);
      return reply.code(500).send();
    }
  });

  fastify.decorate('getHistoryByCondition', async function (req, reply) {
    const bucket = req.query.bucket
    let { obj, objVal, filters } = req.body;
    const TableName = fastify.historyTable;
    const caller = req.user.username;

    if (filters || bucket) {
      if (bucket) (filters ??= {}).bucket = bucket;
      sanitizeFilters(obj, filters);
    }
    if (obj === 'createdTimeNum') {
      const days = getDayList(...objVal.split('~'));
      const results = (await Promise.allSettled(days.map((day) => (
        queryHistory(caller, getQueryConfig({ TableName, obj, objVal: day, filters }))
      ))));

      return reply.send({
        data: results.reduce((output, result) => {
          if (result.status === 'fulfilled') fillListWithItems(output, result.value);
          return output;
        }, []),
      });
    }

    return reply.send({
      data: await queryHistory(caller, getQueryConfig({ TableName, obj, objVal, filters })),
    });
  });

  fastify.decorate('addHistory', async function (req, reply) {
    const caller = req.user.username;
    const { bucket, objKey, action, editor, createdTimeNum } = req.body;

    try {
      const editorIsExist = await checkUserExist(editor);

      if (!editorIsExist) {
        return reply.code(404).send({ message: 'This editor doesn\'t exist' });
      }

      await fastify.dbClient.send(new PutCommand({
        TableName: fastify.historyTable,
        Item: {
          recId: randomUUID(),
          bucket,
          objKey,
          createdAt: dayjs(createdTimeNum.toString()).unix() * 1000,
          createdTimeNum: Number(createdTimeNum),
          action,
          editor,
        },
      }));
      fastify.logStat('info', `${caller}->addHistory`,
        `Success to add object history ([${createdTimeNum}] ${editor} ${action} ${objKey})`);
      return reply.send({ data: null });
    } catch (err) {
      fastify.logStat('error', `${caller}->addHistory`, err);
      return reply.code(500).send();
    }
  });

  fastify.decorate('deleteHistory', async function (req, reply) {
    const caller = req.user.username;
    const historyTable = fastify.historyTable;

    try {
      if (req.body.obj === 'recId') {
        await fastify.dbClient.send(new DeleteCommand({
          TableName: fastify.historyTable,
          Key: { recId: req.body.objVal },
        }));
        return reply.send({ failure: [] });
      } else {
        const { reqItems, failure } = await getDelReqItems(historyTable, req.body, caller)

        if (reqItems.length) {
          const { UnprocessedItems } = await fastify.dbClient.send(new BatchWriteCommand({
            RequestItems: { [historyTable]: reqItems },
          }));

          if (UnprocessedItems[historyTable]) {
            failure.push(`Fail to delete history (count: ${UnprocessedItems[historyTable].length})`);
            UnprocessedItems[historyTable].forEach((item) => {
              fastify.logStat('error', `${caller}->deleteHistory`, `Fail deleted history id: ${item.DeleteRequest.Key.recId}`);
            });
          } else fastify.logStat('info', `${caller}->deleteHistory`, 'Success to delete the history');
        }

        return reply.send({ failure });
      }
    } catch (err) {
      fastify.logStat('error', `${caller}->deleteHistory`, err);
      return reply.code(500).send();
    }
  });

}, {
  name: 's3Recorder',
  dependencies: ['dbInitializer', 'logHandler'],
});