import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import {SceneLogo} from '../components/brand/SceneLogo';
import {SceneAppIcon} from '../components/brand/SceneAppIcon';
import Icon from '../app/icon';
import AppleIcon from '../app/apple-icon';
import {GET as pwaIcon} from '../app/api/pwa-icon/[size]/route';
import manifest from '../app/manifest';
import {SITE_NAME,SITE_URL} from '../lib/seo';

async function main(){
  const root=load(renderToStaticMarkup(<><SceneLogo variant="light" animated={false}/><SceneLogo variant="dark" animated={false}/><SceneLogo variant="red" animated={false}/></>));
  assert.equal(root('svg[role="img"][aria-label="SCENE"]').length,3);
  assert.equal(root('text').text(),'scenescenescene');
  const ids=root('[id]').map((_,el)=>root(el).attr('id')).get();
  assert.equal(new Set(ids).size,ids.length,'repeated header/footer logos use unique mask IDs');
  for(const fill of ['#e0301f','#ff3b2f','#14130f'])assert.ok(root(`rect[fill="${fill}"]`).length>0,'supplied background variants retained');
  assert.ok(!root.text().includes('044'));
  assert.equal(SITE_NAME,'SCENE');assert.equal(new URL(SITE_URL).hostname,'scene044.in','rebranding does not break the domain');
  assert.equal(manifest().short_name,'SCENE');
  assert.ok(renderToStaticMarkup(<SceneAppIcon/>).includes('<path'));
  for(const [response,size] of [[Icon(),32],[AppleIcon(),180],[await pwaIcon(new Request('http://localhost/api/pwa-icon/512'),{params:Promise.resolve({size:'512'})}),512]] as const){
    const png=Buffer.from(await response.arrayBuffer());
    assert.match(response.headers.get('content-type')??'',/image\/png/);
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  console.log('PASS SCENE light/dark/red logos, unique masks, accessible name, unchanged domain, manifest and actual PNG app icons');
}
void main().catch(error=>{console.error(error);process.exitCode=1;});
