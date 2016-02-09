'use strict';
const Spinner = require('cli-spinner').Spinner;
const request = require('request-promise');
const async = require('async');
const pEach = require('promise-each');
const fs = require('fs');
const slug = require('slug');
const moment = require('moment');
const yaml = require('js-yaml');
const path = require('path');
const args = require('optimist')
  .default({dir: 'out', page: 1, user: null})
  .boolean(['noheader', 'nosubdirs'])
  .demand(['token'])
  .usage(`Usage $0 [--dir=out-directory] [--page 1] [--user=someuser] [--noheader] [--nosubdirs]
Get your token from https://gingerhq.com/accounts/api-access/`)
  .argv;

let spinner, headers;

const users = new Map();

function makeDir(dir) {
  try {
    fs.statSync(dir);
  } catch (e) {
    fs.mkdirSync(dir);
  }
}

function timeOut(delay) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
};

function idFromPath(path) {
  if (typeof path !== 'string') return null;
  let segs = path.split('/');
  return parseInt(segs[segs.length - 2], 10);
}

function getUser(url) {
  if (!users.has(url)) {
    return timeOut(200)
    .then(() => {
      return request({
        uri: `https://gingerhq.com${url}`,
        headers
      })
    })
    .then((user) => {
      let u = JSON.parse(user);
      users.set(url, u);
      return Promise.resolve(u);
    })
    .catch((err) => {
      users.set(url, {name: 'Unknown', email: 'unknown@unknown.com'});
      return Promise.resolve({name: 'Unknown'});
    });;
  }
  return Promise.resolve(users.get(url));
};

function printMsg(msg, thread) {
  if (!msg) return;
  return getUser(msg.user)
  .then((user) => {
    if (args.user !== null && args.user !== user.name) {
      return Promise.resolve();
    }
    const data = {
      user: user.name,
      email: user.email,
      created: msg.date_created,
      updated: msg.date_edited,
      id: msg.id,
      parent: idFromPath(msg.parent),
      thread_id: thread.id,
      root: idFromPath(msg.root)
    };
    let out;
    if (args.noheader) { 
      out = msg.raw_body + '\n';
    } else {
      out = `---
${yaml.dump(data)}
---
${msg.raw_body}
`;
    }
    let filename, createdM;
    if (args.nosubdirs) {
      createdM = moment(msg.date_created);
      filename = [args.dir, `${createdM.format('YYYY-MM-DD')}-${msg.id}.md`].join(path.sep);
    } else {
      thread.path[thread.path.length - 1] = `${slug(user.name)}-${msg.id}.md`;
      filename = thread.path.join(path.sep);
    }
    setSpinner(filename);
    fs.writeFileSync(filename, out);
    return Promise.resolve();
  });
}

function setSpinner(msg) {
  if (spinner) spinner.stop(true);
  if (msg) console.log(msg);
  spinner = new Spinner("%s ...");
  spinner.setSpinnerString(4);
  spinner.start();
}

makeDir(args.dir)
headers = {
  Authorization: `Token ${args.token}`,
  'content-type': 'application/json'
};

async.whilst(() => {
  return !!args.page;
},
(wcb) => {
  setSpinner(`Thread page: ${args.page}`);
  request({
    uri: 'https://gingerhq.com/api/v2/discussion/',
    qs: {page: args.page},
    headers
  })
  .then((discs) => {
    discs = JSON.parse(discs);
    args.page = discs.next; 
    return Promise.resolve(discs.results)
    .then(pEach((thread) => {
      const date = moment(thread.message.date_created);
      let next;
      thread.year = date.format('YYYY');
      thread.month = date.format('MM');
      thread.day = date.format('DD');
      thread.path = [args.dir, thread.year, thread.month, thread.day, thread.slug];
      if (!args.nosubdirs) {
        makeDir([args.dir, thread.year].join(path.sep))
        makeDir([args.dir, thread.year, thread.month].join(path.sep));
        makeDir([args.dir, thread.year, thread.month, thread.day].join(path.sep));
        makeDir(thread.path.join(path.sep));
      }
      let out = `---
${yaml.dump({
title: thread.title,
id: thread.id,
slug: thread.slug})}
---
`;
      let filename;
      thread.path.push('thread.md');
      if (args.nosubdirs) {
        filename = [args.dir, `${date.format('YYYY-MM-DD')}-${thread.title}.md`].join(path.sep);
      } else {
        filename = thread.path.join(path.sep);
      }
      if (!args.noheader) {
        fs.writeFileSync(filename, out);
      }
      return request({
        uri: `https://gingerhq.com${thread.url}`,
        headers
      })
      .then((msgs) => {
        msgs = JSON.parse(msgs);
        return printMsg(msgs.message, thread)
        .then(() => {
          return Promise.resolve(msgs);
        });
      })
      .then((msgs) => {
        return Promise.resolve(msgs.children)
      })
      .then(pEach((msg) => {
        return printMsg(msg, thread);
      }))
    }))
  })
  //.then(() => { return timeOut(50); })
  .then(wcb)
  .catch((err) => {
    console.log(err.stack);
    wcb(err);
  });
},
(err) => {
  if (err) console.log(err.stack);
  spinner.stop(true);
});
