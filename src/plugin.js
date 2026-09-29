'use strict';
const definition=Object.freeze({protocolVersion:1,mappingVersion:1,layouts:['standard'],defaults:{layout:'auto',deadzone:0.15,buttonThreshold:0.5}});
function createPlugin() {
 let session=null,queue=Promise.resolve();
 // Both sides of the lifecycle share one queue: an old shutdown must finish
 // before a subsequent activation may register its replacement.
 function enqueue(operation){const result=queue.then(operation);queue=result.catch(()=>{});return result;}
 return {
  activate(pet) {return enqueue(async()=>{
   if(session)return session.result;
   if(typeof pet?.input?.registerProvider!=='function'||typeof pet?.input?.unregisterProvider!=='function')throw Error('input_sdk_unavailable: requires the experimental pet.input host capability');
   const result=await pet.input.registerProvider(JSON.parse(JSON.stringify(definition)));
   session={pet,result};return result;
  });},
  deactivate() {return enqueue(async()=>{
   const own=session;if(!own)return;session=null;
   await own.pet.input.unregisterProvider();
  });}
 };
}
module.exports={createPlugin};
