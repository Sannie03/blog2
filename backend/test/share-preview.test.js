const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { createPublicRouter } = require('../src/routes/public');

test('Vercel sends sharing bots to the preview backend while readers keep the SPA', async () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/vercel.json'), 'utf8'));
  const agents = ['facebookexternalhit/1.1', 'Facebot', 'Twitterbot', 'LinkedInBot', 'Slackbot-LinkExpanding', 'Discordbot', 'WhatsApp/2', 'TelegramBot', 'Zalo', 'Pinterestbot', 'SkypeUriPreview', 'Googlebot', 'bingbot'];
  const app = express();
  app.use(createPublicRouter({ query: async (_sql, params) => ({ rows: params[0] === 'missing' ? [] : [{
    slug: 'sample', title: 'Sample "story"', description: '![cover](https://images.example/portrait.jpg) Story description.', featureImage: '',
  }] }) }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const source of ['/story/:slug', '/post/:slug']) {
      const rules = config.rewrites.filter(rule => rule.source === source);
      assert.equal(rules[0].destination, 'https://blog2-2o8q.onrender.com/story/:slug');
      const matcher = new RegExp(`^${rules[0].has[0].value}$`);
      assert.equal(matcher.test('Mozilla/5.0 Chrome/130.0'), false);
      assert.equal(rules[1].destination, '/index.html');
      for (const agent of agents) {
        assert.ok(matcher.test(agent), `${source} routes ${agent}`);
        const response = await fetch(`${origin}/story/sample`, { headers: { 'User-Agent': agent }, redirect: 'manual' });
        assert.equal(response.status, 200, agent);
        const html = await response.text();
        assert.match(html, /og:image" content="https:\/\/images.example\/portrait.jpg"/);
        assert.match(html, /twitter:image" content="https:\/\/images.example\/portrait.jpg"/);
        assert.match(html, /Sample &quot;story&quot;/);
        assert.doesNotMatch(html, /og:image:width|og:image:height/);
      }
    }
    assert.equal((await fetch(`${origin}/story/missing`, { headers: { 'User-Agent': agents[0] } })).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
