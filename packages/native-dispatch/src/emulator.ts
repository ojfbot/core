/** Fixed local protocol emulator. No imports, tools, credentials, filesystem or network calls. */
export const EMULATOR_PROGRAM = String.raw`
const [provider, scenario, session, version, model, delay, advisoryJSON] = process.argv.slice(1);
const advisory=JSON.parse(advisoryJSON);
const flags=process.argv.slice(8);
if(provider!=='codex' && (flags[0]!=='--print' || (!advisory && flags[1]!=='--resume') ||
 (advisory && !['--resume','--session-id'].includes(flags[1])) || flags[2]!==session ||
 flags[3]!=='--model' || flags[4]!==model || flags[5]!=='--output-format' || flags[6]!=='stream-json' ||
 !flags.includes('--strict-mcp-config') || flags[flags.indexOf('--tools')+1]!=='')) process.exit(90);
const output = value => process.stdout.write(JSON.stringify(value) + '\n');
const turn = 'fixture-turn';
let pointer;
const acceptInput = data => {
  if(advisory) {
    if(data.kind!=='advisory-fixture' || JSON.stringify(data.advisoryFixture)!==JSON.stringify(advisory)) process.exit(90);
    pointer=data.pointer;
  } else pointer=data.pointer ?? data;
  if(Object.keys(pointer).sort().join(',')!=='bindingRevision,message_id,sequence,stream_id,thread_id') process.exit(90);
};
const finish = () => {
  if (scenario === 'disconnect' || scenario === 'queued') return process.exit(0);
  if (scenario === 'hang') return;
  setTimeout(() => {
    const reply=advisory?{ack:{messageId:pointer.message_id,bindingRevision:pointer.bindingRevision,fixtureDigest:advisory.sha256},
      result:{text:'The receiver imported the handoff, the native turn completed, and a separate signed reply was received. Those observations do not verify that the requested work succeeded.'}}:undefined;
    if(provider==='codex' && reply) output({method:'item/completed',params:{threadId:session,turnId:turn,item:{type:'agentMessage',id:'reply',text:JSON.stringify(reply)}}});
    if (provider === 'codex') output({method:'turn/completed',params:{threadId:session,turn:{id:turn,status:scenario==='failed'?'failed':'completed'}}});
    else output({type:'result',session_id:session,is_error:scenario==='failed',result:'emulated native completion',...(reply?{structured_output:reply}:{})});
    process.exit(0);
  }, Number(delay));
};
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
  let end;
  while ((end=input.indexOf('\n')) >= 0) {
    const line=input.slice(0,end); input=input.slice(end+1);
    if (provider !== 'codex') {
      if (JSON.stringify(JSON.parse(line))!==line) process.exit(90);
      acceptInput(JSON.parse(line));
      output({type:'system',subtype:'init',session_id:scenario==='wrong-session'?'wrong':session,model,tools:[],mcp_servers:[]});
      if (scenario==='auth') { output({type:'result',session_id:session,is_error:true,subtype:'error_during_execution',error:'authentication_required'}); process.exit(1); }
      else if (scenario==='approval') { output({type:'result',session_id:session,is_error:true,subtype:'error_during_execution',error:'permission_denied'}); process.exit(1); }
      else finish();
      continue;
    }
    const request=JSON.parse(line);
    if (request.method==='initialize') output({id:request.id,result:{userAgent:'codex/'+version}});
    else if (request.method==='thread/resume') {
      if(request.params?.threadId!==session || request.params?.model!==model || request.params?.cwd!==process.cwd() ||
       request.params?.approvalPolicy!=='never' || request.params?.sandbox!=='read-only') process.exit(90);
      if (scenario==='auth') { output({id:request.id,error:{code:401,message:'authentication_required'}}); process.exit(1); }
      else output({id:request.id,result:{thread:{id:scenario==='wrong-session'?'wrong':session,status:{type:'idle'}}}});
    } else if (request.method==='turn/start') {
      if(request.params?.threadId!==session || request.params?.approvalPolicy!=='never' ||
       request.params?.sandboxPolicy?.type!=='readOnly' || request.params?.input?.length!==1 ||
       request.params.input[0].type!=='text') process.exit(90);
      const data=JSON.parse(request.params.input[0].text);
      if(data.kind!==(advisory?'advisory-fixture':'peer-data-pointer') || !/^[a-f0-9]{64}$/.test(data.dispatchId)) process.exit(90);
      acceptInput(data);
      output({id:request.id,result:{turn:{id:turn,status:'inProgress'}}});
      if (scenario==='approval') output({id:90,method:'item/commandExecution/requestApproval',params:{threadId:session,turnId:turn}});
      else finish();
    } else if (request.id===90) {
      if (request.result?.decision!=='decline') process.exit(91);
      output({method:'turn/completed',params:{threadId:session,turn:{id:turn,status:'interrupted'}}}); process.exit(0);
    }
  }
});
setInterval(()=>{},1000);
setTimeout(()=>process.exit(2),10000);
`;
