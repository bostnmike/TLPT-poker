import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAvatars,withPlayerAvatars,createAvatarLoader,PLAYER_DIRECTORY} from '../player-avatars.mjs';
import {publicFeed,playerView} from '../model.mjs';

const bill = 'images/players/pittsburghbill-766958ed960cb4f1.png';
const directory = image => ({players:[{slug:'pittsburghbill',name:'Do not rename RSVP',image}]});

test('canonical avatar paths stay under the same-site player image directory', () => {
  const unsafe = [
    'https://other.test/avatar.png', '//other.test/avatar.png', 'images/players/../private.png',
    'images/players/p.png?key=private', 'images/players/p.svg', 'data:image/png;base64,abc',
    'images/players/p.png#private', 'images/players/%2e%2e/private.png', null
  ];
  for (const image of unsafe) assert.throws(() => parseAvatars(directory(image)), /No valid/);
  const avatars = parseAvatars({players:[...directory(bill).players,{slug:'bad',image:unsafe[0]}]});
  assert.deepEqual([...avatars],[['pittsburghbill',bill]]);
  assert.throws(() => parseAvatars({players:[...directory(bill).players,...directory(bill).players]}), /Duplicate/);
});

test('avatar overlay changes presentation only and retains canonical RSVP identities', () => {
  const state = {
    revision:12,updatedAt:'2030-01-01',adminHash:'private',audit:['private'],
    players:[
      {slug:'pittsburghbill',name:'PittsburghBill',image:'images/players/pittsburghbill.jpg',generation:3},
      {slug:'p',name:'P',image:'images/players/piercen-craig-v2.webp',linkHash:'private'},
      {slug:'nasa-al',name:'NASA Al',image:'images/players/nasa-al-415effa3f03e46f5.png'},
      {slug:'li-fo',name:'Tony',image:'images/players/li-fo.jpg'}
    ],
    events:[{id:'same',metadata:{slot:'friday',date:'2030-01-04'},capacity:1,open:true,
      responses:{pittsburghbill:{answer:'yes',order:1},p:{answer:'yes',order:2}}}]
  };
  const original = structuredClone(state);
  const view = withPlayerAvatars(state,parseAvatars(directory(bill)));
  const feed = publicFeed(view);
  assert.equal(feed.players.find(p => p.slug==='pittsburghbill').image,bill);
  assert.equal(feed.players.find(p => p.slug==='pittsburghbill').name,'PittsburghBill');
  assert.equal(feed.players.find(p => p.slug==='p').name,'Piercen');
  assert.equal(feed.players.find(p => p.slug==='nasa-al').name,'NASA Al');
  assert.equal(feed.players.find(p => p.slug==='li-fo').name,'ButtonMan');
  assert.equal(playerView(view,'pittsburghbill').player.image,bill);
  assert.deepEqual(feed.events,publicFeed(state).events);
  assert.deepEqual(state,original);
  assert.ok(!JSON.stringify(feed).includes('private'));
});

test('avatar cache coalesces reads, adopts new filenames and retains verified images on failure', async () => {
  let calls=0,clock=100,fail=false,image=bill;
  const load=createAvatarLoader(async (url,init) => {
    calls++;
    assert.equal(url,PLAYER_DIRECTORY);
    assert.equal(init.redirect,'manual');
    assert.equal(init.cache,'no-store');
    if (fail) throw Error('Offline');
    return Response.json(directory(image));
  },() => clock);
  const results=await Promise.all([load(),load(),load()]);
  assert.equal(calls,1);
  assert.ok(results.every(avatars => avatars.get('pittsburghbill')===bill));
  clock+=300001;
  image='images/players/pittsburghbill-next.webp';
  assert.equal((await load()).get('pittsburghbill'),image);
  assert.equal(calls,2);
  clock+=300001;
  fail=true;
  assert.equal((await load()).get('pittsburghbill'),image);
  await load();
  assert.equal(calls,3);
  clock+=30001;
  fail=false;
  assert.equal((await load()).get('pittsburghbill'),image);
  assert.equal(calls,4);
});

test('a newly published avatar replaces missing and default images without changing saved players', async () => {
  let clock=100, published=false;
  const load=createAvatarLoader(async () => Response.json({players:[
    ...directory(bill).players,
    ...(published ? [{slug:'new-player',image:'images/players/new-player-a123.png'}, {slug:'missing-player',image:'images/players/missing-player-b456.webp'}] : [])
  ]}),() => clock);
  const state={players:[{slug:'new-player',name:'New Player',image:'images/site/chip.png'},{slug:'missing-player',name:'Missing Player'}]};
  const original=structuredClone(state);
  assert.equal(withPlayerAvatars(state,await load()).players[0].image,'images/site/chip.png');
  published=true;clock+=300001;
  const view=withPlayerAvatars(state,await load());
  assert.equal(view.players[0].image,'images/players/new-player-a123.png');
  assert.equal(view.players[1].image,'images/players/missing-player-b456.webp');
  assert.deepEqual(state,original);
});

test('unavailable, malformed and oversized directories fall back without an external image URL', async () => {
  for (const fetcher of [
    async () => {throw Error('Offline');},
    async () => new Response('',{status:503}),
    async () => new Response('{broken-json'),
    async () => Response.json({players:[]}),
    async () => Response.json(directory('https://elsewhere.test/image.png')),
    async () => new Response('x'.repeat(100001)),
    async () => Response.json({players:Array(501).fill(directory(bill).players[0])})
  ]) {
    const avatars=await createAvatarLoader(fetcher)();
    assert.equal(avatars.size,0);
    const state={players:[{slug:'pittsburghbill',image:'images/players/pittsburghbill.jpg'}]};
    assert.equal(withPlayerAvatars(state,avatars).players[0].image,state.players[0].image);
  }
});

test('directory deadlines cover stalled fetches and response bodies', async () => {
  let signal;
  const stalledFetch=createAvatarLoader(async (_url,init) => {
    signal=init.signal;
    return new Promise(() => {});
  },Date.now,20);
  assert.equal((await stalledFetch()).size,0);
  assert.equal(signal.aborted,true);
  let cancelled=false;
  const stalledBody=createAvatarLoader(async () => new Response(new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('{"players":['));},
    cancel(){cancelled=true;}
  })),Date.now,20);
  assert.equal((await stalledBody()).size,0);
  assert.equal(cancelled,true);
});
