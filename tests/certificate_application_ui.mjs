import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Users/LENOVO/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:375,height:812}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let submitted;
  await page.route('**/public/certificate-applications',async route=>{
    submitted=route.request().postDataJSON();
    assert.equal(route.request().headers().authorization,undefined);
    await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:'test-request',student_code:'LT-CERT-STU-100001'})});
  });
  await page.goto((process.env.APP_TEST_URL||'http://localhost:3000')+'/certificate-request',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('heading',{name:'Apply for your certificate',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Continue with Google'}).count(),0);
  await page.getByLabel('Full name',{exact:true}).fill('Former Student');
  await page.getByLabel('Email address',{exact:true}).fill('former@example.com');
  await page.getByLabel('Course name',{exact:true}).fill('Web Development');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Submit application'}).click();
  await page.getByRole('heading',{name:'Application received'}).waitFor();
  assert.deepEqual(submitted,{full_name:'Former Student',email:'former@example.com',course_name:'Web Development',website:''});
  assert.match(await page.getByRole('status').innerText(),/LT-CERT-STU-100001/);
  assert.deepEqual(errors,[]);
  console.log('Public route loads without sign-in; only name/email/course submitted; mobile layout and generated ID confirmation passed. API response mocked; no live email sent.');
}finally{await browser.close();}
