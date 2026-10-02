import {test,expect} from '@playwright/test';
test('email enrollment requires explicit confirmation and hides capability from URL',async({page})=>{
 const secret='a'.repeat(64);const posts:any[]=[];
 await page.route('**/api/forum-subscriptions',route=>{if(route.request().method()==='GET')return route.fulfill({json:{emailReady:true}});posts.push(route.request().postDataJSON());return route.fulfill({json:{status:posts.at(-1).action==='confirm'?'subscribed':'unsubscribed'}});});
 await page.goto('/forum#forum-email='+secret);await expect(page.getByRole('button',{name:'Confirm subscription'})).toBeVisible();expect(posts.length).toBe(0);expect(page.url()).not.toContain(secret);
 await page.getByRole('button',{name:'Confirm subscription'}).click();await expect(page.getByRole('status')).toContainText('Subscribed.');expect(posts[0]).toMatchObject({action:'confirm',token:secret});
 await page.getByRole('button',{name:'Unsubscribe',exact:true}).click();await expect(page.getByRole('status')).toContainText('Unsubscribed.');
});
test('email readiness and Chat destination are accurately represented',async({page})=>{
 await page.route('**/api/forum-subscriptions',route=>route.fulfill({json:{emailReady:false}}));await page.goto('/forum');
 await expect(page.getByRole('button',{name:'Subscribe by email'})).toBeDisabled();await expect(page.getByRole('link',{name:'Follow in Bittrees Chat →'})).toHaveAttribute('href','https://chat.bittrees.org/?forum=governance');
});
