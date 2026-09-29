'use strict';
const path=require('node:path');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const host=process.env.PET_GAMEPAD_HOST_DIR;
if(!host||!fs.existsSync(path.join(host,'demo/package.json')))throw Error('PET_GAMEPAD_HOST_DIR must point to the actual SDK host repository. No SKIP is accepted.');
const result=spawnSync('npm',['run','test:input:e2e'],{cwd:path.join(host,'demo'),stdio:'inherit',env:{...process.env,PET_GAMEPAD_PLUGIN_DIR:path.resolve(__dirname,'..')}});
if(result.error)throw result.error;
process.exit(result.status??1);
