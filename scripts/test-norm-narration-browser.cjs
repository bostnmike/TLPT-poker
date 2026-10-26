/* Inline narration and separate written-help regression checks. */
require('./norm-inline-test.cjs')('dashboard',process.argv[2]||'http://127.0.0.1:8767').catch(error=>{console.error(error);process.exitCode=1;});
