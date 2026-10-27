// Run with playwright-cli run-code --filename scripts/qa-inbox-navigation.js.
// Isolated local browser regression, using synthetic service responses only.
async page => {
  if (new URL(page.url()).hostname !== '127.0.0.1') throw new Error('Local test only');
  await page.unroute('**/api/service{,/**}');
  const messages=[{id:'synthetic-message-0001',created:'2026-10-27T08:00:00Z',sender:'student',text:'Local sample question',read:false}];
  const conversationId='synthetic-speaking-review-001';
  const records=[{id:conversationId,created:'2026-10-26T09:24:12Z',date:'2026-10-26',kind:'speaking',title:'Sample saved conversation',visibility:'shared',author:'Student',body:{evidenceType:'AI conversation captions',transcript:'Student: This is the exact saved conversation.\nAI: Tell me one more detail.',summary:'Synthetic conversation only.'}},{id:'synthetic-other-review-0002',created:'2026-10-25T09:00:00Z',date:'2026-10-25',kind:'speaking',title:'A different conversation',visibility:'shared',author:'Student',body:{evidenceType:'AI conversation captions',summary:'Separate synthetic evidence.'}}];
  const events=[{id:'message:synthetic-message-0001',code:'ferdi-7h3k',name:'Sample learner',at:'2026-10-27T08:00:00Z',kind:'message',title:'New message',detail:'Open your conversation.',view:'messages',read:false}];
  events.push({id:'speaking:'+conversationId,code:'ferdi-7h3k',name:'Sample learner',at:'2026-10-26T09:24:12Z',kind:'speaking',title:'Speaking saved',detail:'Sample saved conversation',view:'learning',read:false});
  await page.route('**/api/service{,/**}', async route => {
    const p=route.request().postDataJSON();let r={ok:true};
    if(p.action==='login')r={ok:true,token:'synthetic-local-qa',expires:Date.now()+3600000,role:'teacher'};
    else if(p.action==='teacherDashboard')r={ok:true,students:[{code:'ferdi-7h3k',name:'Sample learner',summary:null,focusNote:''}],generatedAt:'Synthetic local QA'};
    else if(p.action==='teacherNotifications'||p.action==='notifications')r={ok:true,events,unread:events.filter(e=>!e.read).length};
    else if(p.action==='messages')r={ok:true,messages,hasEarlier:false};
    else if(p.action==='messageSend'){const m={id:p.id,created:new Date().toISOString(),sender:'teacher',text:p.text};messages.push(m);r={ok:true,message:m,received:true};}
    else if(p.action==='messagesRead'||p.action==='notificationsRead'){events.forEach(e=>{if(p.ids.includes(e.id))e.read=true;});messages.forEach(m=>{if(p.ids.includes('message:'+m.id))m.read=true;});}
    else if(p.action==='learningRecords')r={ok:true,records,replies:[]};
    else if(p.action==='teacherCalendarLessons'||p.action==='calendarLessons')r={ok:true,lessons:[],tests:[],requests:[],breaks:[]};
    else if(p.action==='learningMemory')r={ok:true,memory:{enabled:true,entries:[],focus:[]}};
    else if(p.action==='documents')r={ok:true,documents:[]};
    await route.fulfill({json:r});
  });
  await page.goto('http://127.0.0.1:4286/teacher/');
  await page.locator('input[type=password],a.inbox-link').first().waitFor();
  if(await page.locator('input[type=password]').count()){await page.locator('input[type=password]').fill('synthetic-local-qa');await page.getByRole('button',{name:'Enter',exact:true}).click();}
  await page.getByRole('link',{name:'Notifications',exact:false}).first().waitFor();
  const checks=[];
  async function heading(text){await page.getByRole('heading',{level:1,name:text,exact:true}).waitFor({timeout:10000});checks.push(text);}
  await heading('Your students, at a glance.');
  await page.setViewportSize({width:1440,height:900});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.reload();await heading('Your students, at a glance.');
  // A long-lived installed app already has a controller when an update arrives.
  await page.evaluate(()=>navigator.serviceWorker.dispatchEvent(new Event('controllerchange')));
  await page.getByRole('button',{name:'New app update · refresh when your work is saved'}).waitFor();
  const bell=await page.getByRole('link',{name:/^Notifications/}).first().boundingBox();
  const bellIsClickable=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('.inbox-link'),{x:bell.x+bell.width/2,y:bell.y+bell.height/2});
  if(!bellIsClickable)throw Error('Update notice blocks the notification bell');checks.push('desktop update notice leaves bell clickable');
  await page.screenshot({path:'output/playwright/desktop-update-banner-after.png',fullPage:true});
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
  await page.getByRole('link',{name:'← Students & teaching',exact:true}).last().click();await heading('Your students, at a glance.');
  await page.getByRole('link',{name:'Messages →',exact:true}).click();await heading('Messages');
  await page.screenshot({path:'output/playwright/inbox-navigation-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const width=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));if(width.content>width.viewport)throw Error('Phone overflow');
  await page.screenshot({path:'output/playwright/inbox-navigation-phone.png',fullPage:true});checks.push('390px layout');
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('link',{name:/^Notifications/}).first().click();await heading('Notifications');
  await page.getByRole('button',{name:'Speaking saved Sample saved conversation'}).click();
  await page.waitForURL('**/teacher/?student=ferdi-7h3k&section=learning&record='+conversationId+'#review-'+conversationId);
  const target=page.locator('#review-'+conversationId);await target.waitFor();
  if(await page.getByRole('button',{name:'Conversations',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('Wrong conversation filter');
  if(await target.getByText('Conversation transcript',{exact:true}).locator('..').getAttribute('open')===null)throw Error('Conversation transcript is still closed');
  await target.getByText('This is the exact saved conversation.',{exact:false}).waitFor();
  await target.screenshot({path:'output/playwright/notification-conversation-desktop.png'});
  await page.setViewportSize({width:390,height:844});await target.screenshot({path:'output/playwright/notification-conversation-phone.png'});
  checks.push('exact conversation with transcript, desktop and phone');
  return {checks,localOnly:true,productionDataUsed:false};
}
