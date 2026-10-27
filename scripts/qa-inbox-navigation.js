// Run with playwright-cli run-code --filename scripts/qa-inbox-navigation.js.
// Isolated local browser regression, using synthetic service responses only.
async page => {
  if (new URL(page.url()).hostname !== '127.0.0.1') throw new Error('Local test only');
  await page.unroute('**/api/service{,/**}');
  const messages=[{id:'synthetic-message-0001',created:'2026-10-27T08:00:00Z',sender:'student',text:'Local sample question',read:false}];
  const events=[{id:'message:synthetic-message-0001',code:'ferdi-7h3k',name:'Sample learner',at:'2026-10-27T08:00:00Z',kind:'message',title:'New message',detail:'Open your conversation.',view:'messages',read:false}];
  await page.route('**/api/service{,/**}', async route => {
    const p=route.request().postDataJSON();let r={ok:true};
    if(p.action==='login')r={ok:true,token:'synthetic-local-qa',expires:Date.now()+3600000,role:'teacher'};
    else if(p.action==='teacherDashboard')r={ok:true,students:[{code:'ferdi-7h3k',name:'Sample learner',summary:null,focusNote:''}],generatedAt:'Synthetic local QA'};
    else if(p.action==='teacherNotifications'||p.action==='notifications')r={ok:true,events,unread:events.filter(e=>!e.read).length};
    else if(p.action==='messages')r={ok:true,messages,hasEarlier:false};
    else if(p.action==='messageSend'){const m={id:p.id,created:new Date().toISOString(),sender:'teacher',text:p.text};messages.push(m);r={ok:true,message:m,received:true};}
    else if(p.action==='messagesRead'||p.action==='notificationsRead'){events.forEach(e=>{if(p.ids.includes(e.id))e.read=true;});messages.forEach(m=>{if(p.ids.includes('message:'+m.id))m.read=true;});}
    else if(p.action==='learningRecords')r={ok:true,records:[],replies:[]};
    else if(p.action==='teacherCalendarLessons'||p.action==='calendarLessons')r={ok:true,lessons:[],tests:[],requests:[],breaks:[]};
    else if(p.action==='documents')r={ok:true,documents:[]};
    await route.fulfill({json:r});
  });
  await page.goto('http://127.0.0.1:4286/teacher/');
  if(await page.locator('input[type=password]').count()){await page.locator('input[type=password]').fill('synthetic-local-qa');await page.getByRole('button',{name:'Enter',exact:true}).click();}
  await page.getByRole('link',{name:'Notifications',exact:false}).first().waitFor();
  const checks=[];
  async function heading(text){await page.getByRole('heading',{level:1,name:text,exact:true}).waitFor({timeout:10000});checks.push(text);}
  await heading('Your students, at a glance.');
  await page.getByRole('link',{name:/^Notifications/}).first().click();await heading('Notifications');
  await page.getByRole('button',{name:'Messages',exact:true}).click();await heading('Messages');
  // Reopening the bell must work even when the URL already names Notifications.
  await page.getByRole('link',{name:/^Notifications/}).first().click();await heading('Notifications');
  async function menuLink(name){await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('dialog').getByRole('link',{name,exact:true}).click();}
  await menuLink('Messages');await heading('Messages');
  await menuLink('Notifications');await heading('Notifications');
  await menuLink('Students & teaching');await heading('Your students, at a glance.');
  await menuLink('Messages');await heading('Messages');
  await page.getByRole('textbox',{name:'Message Sample learner'}).fill('Local navigation regression reply');
  await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText('Sent ✓',{exact:true}).waitFor();
  await page.getByRole('list',{name:'Conversation with Sample learner'}).getByText('Local navigation regression reply',{exact:true}).waitFor();checks.push('local send receipt');
  await page.screenshot({path:'output/playwright/inbox-navigation-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));if(width.content>width.viewport)throw Error('Phone overflow');
  await page.screenshot({path:'output/playwright/inbox-navigation-phone.png',fullPage:true});checks.push('390px layout');
  return {checks,localOnly:true,productionDataUsed:false};
}
