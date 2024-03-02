<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="#">
    <img src="./about/projLogo.png" alt="Logo" width="200">
  </a>
  <div style="font-size:10px;margin:20px;">
    <a href="https://www.flaticon.com/free-icons/folder" title="folder icons">Folder icons created by iconixar - Flaticon</a>
  </div>

  <h1 align="center">AWS S3 Tool</h1>

  <p align="center" style="font-size:16px">
    A tool for manipulating AWS S3 object in file explorer style
    <br />
  </p>
</div>


<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#launch-sample-app">Launch sample app</a></li>
    <li><a href="#functions-showcase">Functions Showcase</a></li>
  </ol>
</details>


<!-- ABOUT THE PROJECT -->
## About The Project

![frontpage](/about/screenshot.png)

### Backend service configuration
  ![service configuration](/about/api_server_structure.png)

  The diagram, generated from the AWS SAM template, illustrates the orchestrated deployment of an API server dedicated to manipulating AWS S3 objects. Within AWS Lambda, two functions play pivotal roles. The first, **`S3ApiSvrAuthorizer`**, examines request source IPs, ensuring secure request handling. The second, **`S3ApiSvr`**, functions as a Fastify API server, taking charge of user management, S3 object operations, and history tracking.
  The AWS API Gateway, **`S3ApiSvrApiGateway`**, acts as a proxy for **`S3ApiSvr`**, offering a range of endpoints that align with handlers only accessible upon successful authorization by **`S3ApiSvrAuthorizer`**.

### Plugins of Fastify api server
- **auth**: Manage user rights, including verification, editing, and deletion.
- **dynamodb**: Provide API database client instance and essential table names.
- **logHandler**: Standardize log in specific format.
- **s3**: Provide a variety of S3 object CRUD handlers.
- **s3Recorder**: Provide the management of operation history through various CRUD handlers.
- **swagger**: Configures settings for API documentation.

### Frontend layout architecture
  ![layout architecture](/about/s3_tool_layout.png)

  The diagram above depicts the hierarchical structure of this application. Beginning with the **`AuthHandler`** component, responsible for verifying user permissions, successful authentication triggers the rendering of components categorized under the **Main Area**. This area is further subdivided into three blocks: Header, Body, and Footer, drawing inspiration from the layout style of Windows File Explorer. Additionally, components classified under **Popup** dynamically appear based on user requirements. 

### Key components:
- **AuthHandler**: Provide sign-in/up for user to gain S3 access rights.
- **DirectoryBlock**: Clearly display the current directory path, simplifying directory switching.
- **BucketStructure**: Present essential information (modified time, size) about objects in the current directory and provide a preview of the first selected object's content.
- **OperationTools**:  Provide CRUD operations, including *create*, *rename*, *copy/paste*, *version swich*, *query*, *download*, and *delete* functionalities.
- **LatestSelectedInfo**:  Show the url of the first selected object, support click-to-copy, and provide url validation by opening a new tab.
- **PermissionHandler**: Allow administrators to edit user authorizations, including managing available buckets and switching between normal user and administrator roles.
- **BucketHistory**: List operation history under specific conditions and offer editing functions for administrators.
- **ObjectUploader**: Organize dropped items in a hierarchical structure and provide real-time status updates on the upload results.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Built With

### Frontend (aws-s3-tool)
* [![Vue][Vue-badge]][Vue-url]
* [![Quasar][Quasar-badge]][Quasar-url]
* [![Axios][Axios-badge]][Axios-url]
* [![Fontawesome][Fontawesome-badge]][Fontawesome-url]
* [![DragSelect][DragSelect-badge]][DragSelect-url]

### Backend (api_server)
* [![AWS][Aws-badge]][Aws-url]
* [![Fastify][Fastify-badge]][Aws-url]


<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Launch Sample App

1. Clone this repo
   ```sh
   git clone https://github.com/CYW-Allen/AWS-S3-Tool.git
   ```
2. Create *.env* files under the directories **./api_server** and **./aws-s3-tool**, and fill the content according to *.env-example* file
3. Run the shell script (*Press Enter to stop the entire app*)
   ```sh
   ./launch-sample-app.sh
   ```

## Functions Showcase

### Get permission
![Page dashboard manipulation](/about/signinup.gif)

### Edit permission
![Page PVPhistory manipulation](/about/editAuth.gif)

### Create object
![Page statistic manipulation](/about/createObj.gif)

### Update object
![Page chipwarRecord manipulation](/about/updateObj.gif)

### Get object
![Page playerInfos manipulation](/about/downloadObj.gif)

### Modify object
![Page accountRelation manipulation](/about/modifyObj.gif)

### Delete object
![Page saleRecord manipulation](/about/deleteObj.gif)

### Query object
![Page namingHistory manipulation](/about/queryObj.gif)

### Edit operation history
![Page sellingRanking manipulation](/about/objHistory.gif)

<p align="right">(<a href="#readme-top">back to top</a>)</p>


<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[product-screenshot]: images/screenshot.png

[Vue-badge]: https://img.shields.io/badge/Vue-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Quasar-badge]: https://img.shields.io/badge/Quasar-blue?style=for-the-badge&logo=quasar
[Quasar-url]: https://quasar.dev/
[AWS-badge]: https://img.shields.io/badge/Amazon_AWS-232f3e?style=for-the-badge&logo=amazonaws
[AWS-url]: https://aws.amazon.com/tw/
[Fastify-badge]: https://img.shields.io/badge/fastify-027804?style=for-the-badge&logo=fastify
[Fastify-url]: https://fastify.dev/
[Axios-badge]: https://img.shields.io/badge/Axios-purple?style=for-the-badge&logo=axios
[Axios-url]: https://axios-http.com/
[Fontawesome-badge]: https://img.shields.io/badge/Font_awesome-lightyellow?style=for-the-badge&logo=fontawesome
[Fontawesome-url]: https://fontawesome.com/
[DragSelect-badge]: https://img.shields.io/badge/dragSelect-skyblue?style=for-the-badge
[DragSelect-url]: https://dragselect.com/

[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Angular-url]: https://angular.io/
[Bootstrap.com]: https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com
[JQuery.com]: https://img.shields.io/badge/jQuery-0769AD?style=for-the-badge&logo=jquery&logoColor=white
[JQuery-url]: https://jquery.com
