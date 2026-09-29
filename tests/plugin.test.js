'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPlugin}=require('../src/plugin');
test('activation registers declarative defaults once and shutdown unregisters without overwriting preferences',async()=>{
 const calls=[];const pet={input:{registerProvider:async d=>{calls.push(['register',d]);return {providerId:'pet-gamepad'};},unregisterProvider:async()=>calls.push(['unregister'])}};
 const plugin=createPlugin();await plugin.activate(pet);await plugin.activate(pet);
 assert.equal(calls.length,1);assert.deepEqual(calls[0][1].layouts,['standard']);
 await plugin.deactivate();await plugin.deactivate();assert.equal(calls.length,2);
});
test('old hosts fail clearly; failed registration can be retried',async()=>{
 const plugin=createPlugin();await assert.rejects(plugin.activate({}),/input_sdk_unavailable/);
 let tries=0;const pet={input:{registerProvider:async()=>{if(++tries===1)throw Error('permission_denied');return {};},unregisterProvider:async()=>{}}};
 await assert.rejects(plugin.activate(pet),/permission_denied/);await plugin.activate(pet);assert.equal(tries,2);await plugin.deactivate();
});
test('shutdown during registration waits for registration then releases it',async()=>{
 let resolve,entered;const started=new Promise(r=>entered=r);let releases=0;const plugin=createPlugin();const pet={input:{registerProvider:()=>{entered();return new Promise(r=>resolve=r);},unregisterProvider:async()=>{releases++;}}};
 const starting=plugin.activate(pet);const stopping=plugin.deactivate();await started;resolve({});await starting;await stopping;assert.equal(releases,1);
});
test('restart cannot be unregistered by the preceding asynchronous shutdown',async()=>{
 const calls=[];let registered=false;const plugin=createPlugin();
 const pet={input:{registerProvider:async()=>{registered=true;calls.push('register');return {};},unregisterProvider:async()=>{registered=false;calls.push('unregister');}}};
 await plugin.activate(pet);
 await Promise.all([plugin.deactivate(),plugin.activate(pet)]);
 assert.deepEqual(calls,['register','unregister','register']);assert.equal(registered,true);
 await plugin.deactivate();
});
test('pending start, stop and restart execute in request order',async()=>{
 let resolve,entered;const started=new Promise(r=>entered=r);const calls=[];const plugin=createPlugin();
 const pet={input:{registerProvider:()=>{calls.push('register');if(calls.length===1){entered();return new Promise(r=>resolve=r);}return Promise.resolve({});},unregisterProvider:async()=>{calls.push('unregister');}}};
 const first=plugin.activate(pet),stop=plugin.deactivate(),restart=plugin.activate(pet);
 await started;assert.deepEqual(calls,['register']);resolve({});
 await Promise.all([first,stop,restart]);assert.deepEqual(calls,['register','unregister','register']);
 await plugin.deactivate();
});
test('a synchronously throwing SDK registration does not poison later activation',async()=>{
 let tries=0;const plugin=createPlugin();const pet={input:{registerProvider:()=>{if(++tries===1)throw Error('registration_failed');return Promise.resolve({});},unregisterProvider:async()=>{}}};
 await assert.rejects(plugin.activate(pet),/registration_failed/);await plugin.activate(pet);assert.equal(tries,2);await plugin.deactivate();
});
