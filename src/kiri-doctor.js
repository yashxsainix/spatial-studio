const { KIRI_API_KEY, KIRI_BASE_URL } = require('./config');
const { getBalance } = require('./kiri');

(async()=>{
  console.log('Spatial Studio · KIRI doctor');
  console.log(`Endpoint: ${KIRI_BASE_URL}/balance`);
  console.log(`API key configured: ${KIRI_API_KEY ? 'yes' : 'no'}`);
  if(!KIRI_API_KEY){ process.exitCode=2; return; }
  try {
    const result = await getBalance();
    console.log('Connection: OK');
    console.log(`Credits: ${result.balance}`);
    console.log(`Provider contract: ${result.response?.successContract || 'unknown'}`);
    console.log(`Provider body code: ${String(result.response?.code ?? 'not supplied')}`);
    console.log(`Provider ok flag: ${String(result.response?.ok ?? 'not supplied')}`);
    console.log('No API secret was printed.');
  } catch (e) {
    console.error('Connection: FAILED');
    console.error(e.message);
    if(e.details){
      const safe={...e.details};
      delete safe.raw;
      console.error(JSON.stringify(safe,null,2));
    }
    process.exitCode=1;
  }
})();
