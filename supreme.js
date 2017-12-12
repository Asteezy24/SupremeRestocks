const Twit = require('twit');
const rp = require('request-promise');
const cheerio = require('cheerio');
const _ = require('underscore');
const fs = require('fs');
const request = require('request');
const SlackWebhook = require('slack-webhook')
const discord = require('discord-bot-webhook');

var originalSoldOutItems = [];
var newSoldOutItems = []
const proxyList = [];
const userAgentList = [];
var restockCycles = 0;//do not change
var refreshDelay = 90000//check every 90 seconds

//uncomment for slack configuration
// const slackWebhookURL = ''
// const slack = new SlackWebhook(slackWebhookURL, {
//   defaults: {
//     username: 'Bot',
//     channel: '#supreme-restocks',
//     icon_emoji: ':robot_face:'
//   }
// })

//uncomment if you need discord
//discord.hookId = ''; 
//discord.hookToken = '';

//uncomment if you need twitter
//var T = new Twit({
//  consumer_key:         '',
//  consumer_secret:      '',
//  access_token:         '',
//  access_token_secret:  '',
//  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
//})

//Uncomment if you need slack or discord or twitter output
//slack.send('Now monitoring for restocks.')
//discord.sendMessage('Now monitoring for restocks.');

console.log('Now monitoring for restocks.');

function initialize(){
  const proxyInput = fs.readFileSync('proxies.txt').toString().split('\n');
  for (let p = 0; p < proxyInput.length; p++) {
      proxyInput[p] = proxyInput[p].replace('\r', '').replace('\n', '');
      if (proxyInput[p] != '')
          proxyList.push(proxyInput[p]);
  }
  const userAgentInput = fs.readFileSync('useragents.txt').toString().split('\n');
  for (let u = 0; u < userAgentInput.length; u++) {
      userAgentInput[u] = userAgentInput[u].replace('\r', '').replace('\n', '');
      if (userAgentInput[u] != '')
          userAgentList.push(userAgentInput[u]);
  }
  console.log('Found ' + proxyList.length + ' Proxies.');
  console.log('Found ' + userAgentList.length + ' User Agents.');
  scrape(originalSoldOutItems);
}

function scrape(arr) {

  request({
      url: 'https://www.supremenewyork.com/shop/all',
      headers: generateRandomUserAgent(),
      timeout:80000,
      proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
  }, function(error, response, html) {

      if (response && response.statusCode != 200) {
          console.log('Cannot make the Request');
          return null;
      }

      if(!html){
        console.log('Did not get response.');
        return null;
      }
      var $ = cheerio.load(html);

      $('.inner-article').each(function(i, elm) {
          if (elm.children[0].children[1] != undefined) {
              arr.push(elm.children[0].attribs['href']);
          }
      }); //end of loop jQuery function
      if (restockCycles != 0) {
          if (newSoldOutItems.length < originalSoldOutItems.length) {
              console.log('RESTOCK OCCURED!!!');
              var restockedItems = findArrayDifferences(originalSoldOutItems, newSoldOutItems);
              console.log(restockedItems)
              //postToSlack(restockedItems)
              //postToDiscord(restockedItems)
              //postToTwitter(restockedItems)
              originalSoldOutItems = newSoldOutItems; //reset the variable
          }

          if(newSoldOutItems.length > originalSoldOutItems.length){ // more items sold out
            originalSoldOutItems = newSoldOutItems; //reset the variable
          }
      }
      restockCycles++;
      console.log('Completed Restock Cycle #' + restockCycles + '\n');
      setTimeout(function() {
          newSoldOutItems = [];
          scrape(newSoldOutItems)
      }, refreshDelay)

  }); //end of request call
}

function findArrayDifferences(arr1, arr2) {
    return _.difference(arr1, arr2)
}

function formatProxy(proxy) {
    if (proxy && ['localhost', ''].indexOf(proxy) < 0) {
        proxy = proxy.replace(' ', '_');
        const proxySplit = proxy.split(':');
        if (proxySplit.length > 3)
            return "http://" + proxySplit[2] + ":" + proxySplit[3] + "@" + proxySplit[0] + ":" + proxySplit[1];
        else
            return "http://" + proxySplit[0] + ":" + proxySplit[1];
    } else
        return undefined;
}

function generateRandomUserAgent(){
  var userAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
  return {'User-Agent': userAgent}
}

function postToSlack(restockedItems){
  for (let i = 0; i < restockedItems.length; i++) {
      request.get({url:'http://www.supremenewyork.com' + restockedItems[i]}, function(error, response, body) {
          if (body) {
              let $ = cheerio.load(body);
              var itemName = $('h1[itemprop="name"]').text();
              slack.send({
                text: 'http://www.supremenewyork.com' + restockedItems[i],
                username: itemName,
                icon_emoji: ':scream_cat:',
                channel: '#supreme-restocks'
              })
          } else {
            console.log('Could not find Item Name.');
          }
      })
  }
}

function postToDiscord(restockedItems){

  for (let i = 0; i < restockedItems.length; i++) {
      request.get({url:'http://www.supremenewyork.com' + restockedItems[i]}, function(error, response, body) {
          if (body) {
              let $ = cheerio.load(body);
              var itemName = $('h1[itemprop="name"]').text();
              discord.userName = itemName
              discord.sendMessage('http://www.supremenewyork.com' + restockedItems[i]);
          } else {
            console.log('Could not find Item Name.');
          }
      })
  }
}

function postToTwitter(restockedItems){
  for (let i = 0; i < restockedItems.length; i++) {
      request.get({url:'http://www.supremenewyork.com' + restockedItems[i]}, function(error, response, body) {
          if (body) {
              let $ = cheerio.load(body);
              var itemName = $('h1[itemprop="name"]').text();
              T.post('statuses/update', { status: itemName + ' http://www.supremenewyork.com' + restockedItems[i] }, function(err, data, response) {
                 console.log('Tweet Posted!')
               })
          } else {
            console.log('Could not find Item Name.');
          }
      })
  }
}


initialize()
