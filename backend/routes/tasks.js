==> Downloading cache...
==> Cloning from https://github.com/vishnukr33-hash/planit
==> Checking out commit 4d8b7961f660f6541c4f3cb6864939de46700b60 in branch main
==> Downloaded 13MB in 0s. Extraction took 1s.
==> Using Node.js version 24.14.1 (default)
==> Docs on specifying a Node.js version: https://render.com/docs/node-version
==> Running build command 'npm install'...
up to date, audited 176 packages in 723ms
26 packages are looking for funding
  run `npm fund` for details
9 vulnerabilities (6 moderate, 3 high)
To address issues that do not require attention, run:
  npm audit fix
To address all issues (including breaking changes), run:
  npm audit fix --force
Run `npm audit` for details.
==> Uploading build...
==> Uploaded in 1.8s. Compression took 1.3s
==> Build successful 🎉
==> Deploying...
==> Setting WEB_CONCURRENCY=1 by default, based on available CPUs in the instance
==> Running 'node server.js'
/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469
      throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
      ^
TypeError: Router.use() requires a middleware function but got a Object
    at router.use (/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469:13)
    at app.<anonymous> (/opt/render/project/src/backend/node_modules/express/lib/application.js:227:21)
    at Array.forEach (<anonymous>)
    at app.use (/opt/render/project/src/backend/node_modules/express/lib/application.js:224:7)
    at Object.<anonymous> (/opt/render/project/src/backend/server.js:27:5)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10)
    at Module.load (node:internal/modules/cjs/loader:1533:32)
    at Module._load (node:internal/modules/cjs/loader:1335:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
Node.js v24.14.1
==> Exited with status 1
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Running 'node server.js'
/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469
      throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
      ^
TypeError: Router.use() requires a middleware function but got a Object
    at router.use (/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469:13)
    at app.<anonymous> (/opt/render/project/src/backend/node_modules/express/lib/application.js:227:21)
    at Array.forEach (<anonymous>)
    at app.use (/opt/render/project/src/backend/node_modules/express/lib/application.js:224:7)
    at Object.<anonymous> (/opt/render/project/src/backend/server.js:27:5)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10)
    at Module.load (node:internal/modules/cjs/loader:1533:32)
    at Module._load (node:internal/modules/cjs/loader:1335:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
Node.js v24.14.1
==> Running 'node server.js'
/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469
      throw new TypeError('Router.use() requires a middleware function but got a ' + gettype(fn))
      ^
TypeError: Router.use() requires a middleware function but got a Object
    at router.use (/opt/render/project/src/backend/node_modules/express/lib/router/index.js:469:13)
    at app.<anonymous> (/opt/render/project/src/backend/node_modules/express/lib/application.js:227:21)
    at Array.forEach (<anonymous>)
    at app.use (/opt/render/project/src/backend/node_modules/express/lib/application.js:224:7)
    at Object.<anonymous> (/opt/render/project/src/backend/server.js:27:5)
    at Module._compile (node:internal/modules/cjs/loader:1812:14)
    at Object..js (node:internal/modules/cjs/loader:1943:10)
    at Module.load (node:internal/modules/cjs/loader:1533:32)
    at Module._load (node:internal/modules/cjs/loader:1335:12)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
Node.js v24.14.1
