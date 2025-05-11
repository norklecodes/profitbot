const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const axios = require('axios');

require('dotenv').config();

// CONFIG
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

if (!BOT_TOKEN || !CHANNEL_ID || !CLIENT_ID || !ALPHA_VANTAGE_API_KEY) {
  console.error('Missing required environment variables. Please set BOT_TOKEN, CHANNEL_ID, CLIENT_ID, and ALPHA_VANTAGE_API_KEY in .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// TRACKING SYSTEM 
let blownPorts = 0;
let blownAccounts = 0;
const userPnL = {}; // Object to store user-specific PnL { userId: { profit: number, loss: number } }
const userCoins = {}; // Object to store user coin balances { userId: number }

// TIERED GIF POOLS
const imagePools = {
  "0_100": ["https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDQzbHk5NGIwZWwzbTBtNzgxZ3JvdjM4ZHVweWQ0OG14dm4wc2VoNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/toHk1wZ75jNO8/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2c3dGI3NWVxbDRocHN3Mm13NTVoZ201bnZydWJtbjloazNvYWp5YSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/2JSPxQoIo5t7Pfsf4e/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHZhdzM4cmo0NWlwa3Nma240b2hsajV4ZG84ajlqZWdyczhtcnNqNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xThuW2Vrx2ruC42Dcc/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzVkbTV3aHplMm1ram9vZmJ5Z2VwcGxta3h6Z2Y0ZTA5Ynh2YW5mYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/k0hKRTq5l9HByWNP1j/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa20ycGhpeDBydTdnZWt0Y2k0eHcwanhvNHEwejBsbHlrMGhpd2J2diZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oFzlV2pq0nnFntAZ2/giphy.gif",
    "https://media.giphy.com/media/H4s7qjFZk486I/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHhid3lvdGd3cHo4YWh0N2I0cWhsZzF2Y2doN3JsZWV0aWwyM3lucyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/c5PHIq9sXsV6o/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXU0ZTkyb2syMnAwNTB5NmkwbWd4aXRuYXI3Z2MxYmgxamFvZXprbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NEvPzZ8bd1V4Y/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmhjZm00ZzJ2bXlkbTBuOGd6eTUwYnF4cThsOTVhZWJ3Z2lyYnA4MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7abKhOpu0NwenH3O/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnR6azc4ejByOGh2cnp3ZGtqZDE5NnE3eG56ZTgzNGF2cmxtcDd3MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/O9mpHQ6N73V91184LM/giphy.gif"],
  "101_200": ["https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDQzbHk5NGIwZWwzbTBtNzgxZ3JvdjM4ZHVweWQ0OG14dm4wc2VoNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/pp37ctN31nM7pr03iu/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2xyeXo0N2ZjYmNqeTR5eWd1d3EybnR4bm11MW45M25xeWlhcndkNiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0ErFafpUCQTQFMSk/giphy.gif",
    "https://media.giphy.com/media/XfQDhhaVjL0wOl9Jkr/giphy.gif",
    "https://media.giphy.com/media/ogY2CwzJahy6VfIkq6/giphy.gif",
    "https://media.giphy.com/media/tl2zUlikA4IfnpY1K5/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXB4cWlrMWhzMXVud3BqNml3NHQ5NWhxdzFvMjJteWZpY3l2YWQyMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NUj5zmWpai3WAYfvnW/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXU0ZTkyb2syMnAwNTB5NmkwbWd4aXRuYXI3Z2MxYmgxamFvZXprbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/pCO5tKdP22RC8/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDdkb3dyejRiMDMxMnh0NTZhcHpxbnQydXFnOGc1bHhreHZveHVmOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/IwAZ6dvvvaTtdI8SD5/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnR6azc4ejByOGh2cnp3ZGtqZDE5NnE3eG56ZTgzNGF2cmxtcDd3MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26ufcQNzm5YwuNxja/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeHJxOHhpZ2ltOTk0Y2F5dGk2bjhyc2k2dHg5ZnY3cWxxc3Z5Y3I5diZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jtF9aTmTEBzhoUu6YJ/giphy.gif"],
  "201_500": [ "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDQzbHk5NGIwZWwzbTBtNzgxZ3JvdjM4ZHVweWQ0OG14dm4wc2VoNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lXiRlrztGuaoFAhIA/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExb2xyeXo0N2ZjYmNqeTR5eWd1d3EybnR4bm11MW45M25xeWlhcndkNiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ter8BPkM76vCfD6l5Q/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanB6OTAyd2JtZmk3M3Vsd2JpN2U4ZW8ycmJqcnFtdzhtdW5peDIxeSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/x75bNKgNhYILXvGt8R/giphy.gif",
    "https://media.giphy.com/media/asV6zKgUiIsIE/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjhzdHljaWNjOWt2MHdjc3plazBpdG9pM2lmdzR2NWRyc2Npb2g3dyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4Tkagznwgrv6A4asQb/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeXU0ZTkyb2syMnAwNTB5NmkwbWd4aXRuYXI3Z2MxYmgxamFvZXprbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xT77XWum9yH7zNkFW0/giphy.gif",
    "https://media.giphy.com/media/aCryRLS1kftg4/giphy.gif",
    "https://media.giphy.com/media/26FPzWoJlFvXyiZ6E/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExemd6NzgxdXV6dXI2c2Nob242M3Y4YXh1amlsZjV2dzN0N28xOWZjdyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cMso9wDwqSy3e/giphy.gif",
    "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnQ5cHExejh0ODl3M3YwaXFtaWxwbmEzMjBzdTU3OXUyZDcwbnlmMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xNBcChLQt7s9a/giphy.gif", "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDQzbHk5NGIwZWwzbTBtNzgxZ3JvdjM4ZHVweWQ0OG14dm4wc2VoNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/eUbmLMxzRCLu0/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmVwamI1Y2MxcG9jcnEwZTBmcG1pcTNmdWVsMDlhZDl5cXRlZWM2eCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/pbV5lYogNRZ2Re4kzG/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmU2ODRzbmRvYTRyNjNiMTEyNXYyY3RqM3l6ZjIzZHFwenVib3AwMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l41lZccR1oUigYeNa/giphy.gif",
    "https://media.giphy.com/media/WBJhPscwlOCg3nlyzL/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjhzdHljaWNjOWt2MHdjc3plazBpdG9pM2lmdzR2NWRyc2Npb2g3dyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mp1JYId8n0t3y/giphy.gif",
    "https://media.giphy.com/media/v88adW7gu6dMTqI8dZ/giphy.gif",
    "https://media.giphy.com/media/8i7IQbqY4iXuD3MDRT/giphy.gif",
    "https://media.giphy.com/media/l42P7LGjW2aGRfvXy/giphy.gif",
    "https://media.giphy.com/media/eNpJRIHg0VQIQHcrEl/giphy.gif",
    "https://media.giphy.com/media/Hu4Xs3mfIIY6s/giphy.gif", "https://media.giphy.com/media/11WP2CzziW5j56/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGQwMnY4ZXlwa25qa2lzdG80eHI5YXJjOWJob28ycjhyOXpjeGw5biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/EchO3S7A8QSJL4dMgg/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmU2ODRzbmRvYTRyNjNiMTEyNXYyY3RqM3l6ZjIzZHFwenVib3AwMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MAA3oWobZycms/giphy.gif",
    "https://media.giphy.com/media/RNB78mRUtCF7N6w5ib/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjhzdHljaWNjOWt2MHdjc3plazBpdG9pM2lmdzR2NWRyc2Npb2g3dyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/rjkJD1v80CjYs/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXB5YTczZGFiOWJpdHdnano0b2VtaDFiZWUzZXI0ZGNqZDRhanI0dSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WZOaHkoFoDUBOl4cFo/giphy.gif",
    "https://media.giphy.com/media/Qh6NZWsFx1G1O/giphy.gif",
    "https://media.giphy.com/media/JsTpb3KssSayc/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXFyNXMxZm81eGlwbHU0Y2R0MTA1eHBtNXppbnBtanVzbGxvZmI5ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3ohryhNgUwwZyxgktq/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGhqbGJqMmZlOHBzMmM4ODRja3puM3VsMTEwdGJxbnhnZHEzYWU3byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l3nF8lOW9D0ZElDvG/giphy.gif" ],
  "501_1000": ["https://media.giphy.com/media/nEZ822P20D1NeEv0lU/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnZxbzNvMjh6MnV5aTk4cjdydWt0Mzh3dThrZng1amhsbGt6Z3gwaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/9yMAzItzKd5Jop4SHp/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmI5Nm1pcnUzNzdhd2RwcDAzOXB0YzFrcHluMmxucGQ2NHZpdG5pdiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/67ThRZlYBvibtdF9JH/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbjZpdHF3aHAwbHBkaTdqcDVoYW5rcHo5bWF0d2h1aTBrNzUzdWRuZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/tEo3KaN5L17qg/giphy.gif",
    "https://media.giphy.com/media/BRRYxC7tBbBvIrXZRb/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHhid3lvdGd3cHo4YWh0N2I0cWhsZzF2Y2doN3JsZWV0aWwyM3lucyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UjCXeFnYcI2R2/giphy.gif",
    "https://media.giphy.com/media/pcfdfm6hjTvji/giphy.gif",
    "https://media.giphy.com/media/MTclfCr4tVgis/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXFyNXMxZm81eGlwbHU0Y2R0MTA1eHBtNXppbnBtanVzbGxvZmI5ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l3q2Z6S6n38zjPswo/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXY1Nzlsdm5meXRqem55YWtwM3FvNzNuNHhqbnRjZG5leHRreDJ2ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/p0tN0OQ4utogNDGWL3/giphy.gif", "https://media.giphy.com/media/fo84ixgUWpf9K3vcHe/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGQwMnY4ZXlwa25qa2lzdG80eHI5YXJjOWjob28ycjhyOXpjeGw5biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8mAeiYfGoydhju8cMC/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmI5Nm1pcnUzNzdhd2RwcDAzOXB0YzFrcHluMmxucGQ2NHZpdG5pdiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/o4Hy165vDlmDe/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXljM3FlMjZ2bG04dDJibHV2cjN6amYzc2d1MmRsOHd6c3NuN3pqayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/GeEA4adCdZvY7UWYMk/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTg0cHNmNGxrc3dmemU0NHp6aGJ5M2VwbnQ3eGRndm1uaWE4Njl5eSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/KTqMDuGdI4qmfwdI1t/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExczhjdmxxNWMwZHJ5d2V0djV1ZXc5a2ZsMWJ5OWkyeGpzY2UzMDFkciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/eIF1Y1TexgqlUjyJfA/giphy.gif",
    "https://media.giphy.com/media/26BGKJGlwVl02OXrW/giphy.gif",
    "https://media.giphy.com/media/JvtrhAX8aXo4w/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXY1Nzlsdm5meXRqem55YWtwM3FvNzNuNHhqbnRjZG5leHRreDJ2ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/czdK1BXC2CU047mhdt/giphy.gif",  "https://media.giphy.com/media/4Ke4x8cQMBUQM/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExang4MG4ybXlpYXF5MW1vNmJwenYyMzFweHM5d3U1ZWVwY2s0c3NlMyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/laUY2MuoktHPy/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmI5Nm1pcnUzNzdhd2RwcDAzOXB0YzFrcHluMmxucGQ2NHZpdG5pdiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MFsqcBSoOKPbjtmvWz/giphy.gif",
    "https://media.giphy.com/media/GjB6t5kfrx4nfxkHcA/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXljM3FlMjZ2bG04dDJibHV2cjN6amYzc2d1MmRsOHd6c3NuN3pqayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YZCtTWZPlLzXLYtf4O/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2g5ZWFjbHNxZGloOHN1Yjg2eWlobWlvdDU3NzlwMDk3M3hkMmhydyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/hs7Pvg2O3dFqliXKAl/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXA1aWFqcHRtbjE2NzZtNmNkcmVseXJ3Y2htamg1YmE3Zmx0eHhkbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j0aJCXT3LDgQRCgB77/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnRyMjUycTVvcmlmYXJ3NWhqbmV4cHd4NThpajY5b2UwNjZhdmo1OSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l56jabb3hIadcTSpQB/giphy.gif",
    "https://media.giphy.com/media/3o7aCReOCepWnsNuSs/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGhqbGJqMmZlOHBzMmM4ODRja3puM3VsMTEwdGJxbnhnZHEzYWU3byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jm4nsAWdCV4Lm/giphy.gif",  "https://media.giphy.com/media/enWTPWx5SXkTS/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGQwMnY4ZXlwa25qa2lzdG80eHI5YXJjOWjob28ycjhyOXpjeGw5biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/uZmwmfbxh3xkiI1pFM/giphy.gif",
    "https://media.giphy.com/media/xT5LMPw4133KKkpzEc/giphy.gif",
    "https://media.giphy.com/media/XDlDcYHaLujSw/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXljM3FlMjZ2bG04dDJibHV2cjN6amYzc2d1MmRsOHd6c3NuN3pqayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LkgJS2HDKHKZXXvLo1/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXB4cWlrMWhzMXVud3BqNml3NHQ5NWhxdzFvMjJteWZpY3l2YWQyMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/0o39uVTq9XVbFPOXFn/giphy.gif",
    "https://media.giphy.com/media/3yIZWwjHtZjR5Y03Le/giphy.gif",
    "https://media.giphy.com/media/XfT1Xb2O2ShHy/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXFyNXMxZm81eGlwbHU0Y2R0MTA1eHBtNXppbnBtanVzbGxvZmI5ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/109om8H9KSWnNS/giphy.gif",
    "https://media.giphy.com/media/l0MYsDv6p413P5Q9q/giphy.gif", "https://media.giphy.com/media/l1Et96WM1hPWvAb04/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanViMnhsNDZiOXJwZzJ5M21xZHE5bWJ3MDlrOHNrZWQ5Mmt2NDhmMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/QJrdWvgrLyNdm/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzY2a2xqY2k3cTg5YjZtdTE2bGdyMWt3cWZ4bGV1MjhsYWtuZ3U1aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/0IWeBirDeRK4dG0Egl/giphy.gif",
    "https://media.giphy.com/media/d6LGWQbs3Y3yUESdjm/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNTJhMHRpd2JlZXplcDcwbDI4NXpqc3p4bnZlb3A4Y2JzNnM2NTA1YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0HlNIFcDD5EqQeFq/giphy.gif",
    "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2s0cmU4Zm5peWF0M3JoN3M4OXUxNmp4bHp1azh6ZWprbTF6cmp1ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/IxLZlXI2LfL65IND9p/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDdkb3dyejRiMDMxMnh0NTZhcHpxbnQydXFnOGc1bHhreHZveHVmOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7abldj0b3rxrZUxW/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXBheHR4NXdxaDdrdjVxZjF5N3BveHJidzRoYmNweTIyemF5aW1heiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/d8C9QwHsFQgR39MSTq/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDQxOHR0dmpveXBoa2c5Ym55c2I2OG1vdW15cXo1ZGd2bmI4dmV0NyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/7TtvTUMm9mp20/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXl3cjBjNmhxaWY4cHdkeGQ1dzB5czNubWVlcGt1eGh4cjNhaXB6MiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o751YVqovWIxqJC5q/giphy.gif"],
  "1001_1500": ["https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZDQzbHk5NGIwZWwzbTBtNzgxZ3JvdjM4ZHVweWQ0OG14dm4wc2VoNSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1fkCfHgp4IGPUQaNhK/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGwxa2ppZWF2N3R6d3AybHdvNGpnZWxwaW52cHdxajE0MDFqcThtcyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l2Sq25IpRdArf6iAw/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZzY2a2xqY2k3cTg5YjZtdTE2bGdyMWt3cWZ4bGV1MjhsYWtuZ3U1aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BB0M2F1dzIy7rFaQ3/giphy.gif",
    "https://media.giphy.com/media/RJ1ETdKAxiUjdDnsNJ/giphy.gif",
    "https://media.giphy.com/media/xWGcWedXtVYKI04jKr/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJwYWl2YXNsZGduNjd0cHRjcTRzbXByaHZkOHc0bGN2bHczN2FuaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xv0dyjkSmaUdG/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDMxY3NnNjVjMWh6ZmhjMjZiOXl3dHphY2dud3g3ZHpkeHlrdG8yaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/126CZqbY33wNgc/giphy.gif",
    "https://media.giphy.com/media/yCjr0U8WCOQM0/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXY1Nzlsdm5meXRqem55YWtwM3FvNzNuNHhqbnRjZG5leHRreDJ2ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/co6GOQDwHnaP7ANZXK/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXl3cjBjNmhxaWY4cHdkeGQ1dzB5czNubWVlcGt1eGh4cjNhaXB6MiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5h1Y4PTe9xVrQ4i73S/giphy.gif", 
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGdjMmZsYWNnazJ6YnE0MXN4NGJrdHBqY20wNXRmdnMwZXVieDN3diZlcD12MV9naWZzX3NlYXJjaCZjdD1n/148x4ezZxvpIeA/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNGwxa2ppZWF2N3R6d3AybHdvNGpnZWxwaW52cHdxajE0MDFqcThtcyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/14rk56liuv7mQo/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGtzejB4bDBwcGd6bGszNWZ1M3RhMXR3NDhkdXdhMTZ4NmhuOGw5byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YtXhHnouybHEmT7Xkh/giphy.gif",
    "https://media.giphy.com/media/PHklSZIsa8xYY7yoCR/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWtvaGgybHY4cTgzMXh4ODNrMXVqbHY5c2txdWV0NDcwZzllZnR1bCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6gE1LY6fpQKb3beo/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTg0cHNmNGxrc3dmemU0NHp6aGJ5M2VwbnQ3eGRndm1uaWE4Njl5eSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/nJfScKSWBENnTph4Ki/giphy.gif",
    "https://media.giphy.com/media/z8gtBVdZVrH20/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXcxYmpucWRlZ293eGxiOGZuODU3eWR2eW8zeWVlYm8xcHp5amY1eiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/d3OG6pQJyk7v1i2Q/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXY1Nzlsdm5meXRqem55YWtwM3FvNzNuNHhqbnRjZG5leHRreDJ2ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/2xEC1SQQgW5CxLOxMr/giphy.gif",
    "https://media.giphy.com/media/AL0XsYU0pkFTq/giphy.gif",  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGdjMmZsYWNnazJ6YnE0MXN4NGJrdHBqY20wNXRmdnMwZXVieDN3diZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Priuav2CnPQxq/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExanViMnhsNDZiOXJwZzJ5M21xZHE5bWJ3MDlrOHNrZWQ5Mmt2NDhmMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/infzuIklrTFcs/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGtzejB4bDBwcGd6bGszNWZ1M3RhMXR3NDhkdXdhMTZ4NmhuOGw5byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jtWcxbqvNuiFZdcnnC/giphy.gif",
    "https://media.giphy.com/media/GQvjJ6KH0IWZNUlpPn/giphy.gif",
    "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHoweWRwczdpMGs3OXRrcm12eHFqdnoyYWk5ejUzNjcyOGR2bDY0OSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/K6YIrF9mBdAKhSbC7c/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmhjZm00ZzJ2bXlkbTBuOGd6eTUwYnF4cThsOTVhZWJ3Z2lyYnA4MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/QXguQA0A2E9cfrgGwP/giphy.gif",
    "https://media.giphy.com/media/bxQKzvlXsCXpm/giphy.gif",
    "https://media.giphy.com/media/ruiyzuwblA0dnSEPuf/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXl3cjBjNmhxaWY4cHdkeGQ1dzB5czNubWVlcGt1eGh4cjNhaXB6MiZlcD12MV9naWZzX3NlYXJjaCZctD1nJmFwPTE/VpT1JLZt2v5dYcjGwa/giphy.gif",
    "https://media.giphy.com/media/XxPdNOvs7fMPURNXEQ/giphy.gif", "https://media.giphy.com/media/VQEgNORX6MvGkefs8R/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXVsdGFwbnc3ZncwYW8ya3ZwbjNld3R1ZnI3enJnMzZoMmZpaDhuMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6S2Q6LcnNd0hLsc9BD/giphy.gif",
    "https://media.giphy.com/media/ENcROyB1aZIk4KchRS/giphy.gif",
    "https://media.giphy.com/media/xT5P0JjrZgCPsurlqo/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmVkZDF0anY5aXlnY2hkazJncXJkZzVkcHV3c3ZyZ2thOHlsZjQ2cCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jrutBd1N7ZhsINAPzs/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2U0cHNpZmw1ZDJ3eGNkMDVyYmE1Z2l0NHhqZHk3ajc3NTdkdHNuZSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SYGkVEBAhm0g0/giphy.gif",
    "https://media.giphy.com/media/FWjyp3cyUEKe2wrbXA/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnRyMjUycTVvcmlmYXJ3NWhqbmV4cHd4NThpajY5b2UwNjZhdmo1OSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ca1ih5CtrgXWoTuKMb/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXFyNXMxZm81eGlwbHU0Y2R0MTA1eHBtNXppbnBtanVzbGxvZmI5ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cOB8cDnKM6eyY/giphy.gif",
    "https://media.giphy.com/media/etKSrsbbKbqwW6vzOg/giphy.gif", "https://media.giphy.com/media/13M7YIZYHUofRe/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnZxbzNvMjh6MnV5aTk4cjdydWt0Mzh3dThrZng1amhsbGt6Z3gwaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/rmi45iyhIPuRG/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmU2ODRzbmRvYTRyNjNiMTEyNXYyY3RqM3l6ZjIzZHFwenVib3AwMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/LdOyjZ7io5Msw/giphy.gif",
    "https://media.giphy.com/media/A6teeK6Yy24O5yPCcP/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmVkZDF0anY5aXlnY2hkazJncXJkZzVkcHV3c3ZyZ2thOHlsZjQ2cCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/oYtVHSxngR3lC/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJwYWl2YXNsZGduNjd0cHRjcTRzbXByaHZkOHc0bGN2bHczN2FuaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/k8AR3ns2qfwl2/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTltaXRjdXVicndlamYzbm44Y3ZvbGZoNHMxaWgzYWNkYXQwOGMxcyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/DtvwwLmlClov6/giphy.gif",
    "https://media.giphy.com/media/79EBYnTZjbLfG/giphy.gif",
    "https://media.giphy.com/media/YIo7D00296YL6LyV2P/giphy.gif",
    "https://media.giphy.com/media/K3RxMSrERT8iI/giphy.gif" ],
  "1500+": ["https://media.giphy.com/media/Mbi3S88za8YMFnnSjx/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGQwMnY4ZXlwa25qa2lzdG80eHI5YXJjOWjob28ycjhyOXpjeGw5biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oriOafgCGbCjVI7S0/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzk1bHc4aGM3c2x2cDk0YjBmYW02d2g3MjZtOG5oNDN3bDFucjBkdSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Jso1dbifABkyEDiIXQ/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTlpbmk2OHl0bnN2bmI3NDN3eGg5aDBtYTdlb2Jzb21hZmZoMGg3cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BYhoMtJMQsYVy/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHg1ZHdnZjE2bHZjbW1hYjQ1a3BoMTAwbDliemZjOHloeWw5dmUwdCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/126Atuf8ZpQsQE/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJwYWl2YXNsZGduNjd0cHRjcTRzbXByaHZkOHc0bGN2bHczN2FuaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lptjRBxFKCJmFoibP3/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJwYWl2YXNsZGduNjd0cHRjcTRzbXByaHZkOHc0bGN2bHczN2FuaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/la6Ne7z15BXs4/giphy.gif",
    "https://media.giphy.com/media/al1YVDLtGleAIwoPwV/giphy.gif",
    "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTltaXRjdXVicndlamYzbm44Y3ZvbGZoNHMxaWgzYWNkYXQwOGMxcyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/cF7QqO5DYdft6/giphy.gif",
    "https://media.giphy.com/media/i24Th0JGjjZWHwpTrH/giphy.gif"]
};

const blownGifs = [ 
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjcwY29paG95d3Z5Znp1cTUyejAxcDBzbmx2bHhwczFiZDI3ajRjbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/hKPk4UI4xZIKY3YBZ3/giphy.gif",
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWd2djJzemExbTJydXNubDN2dTc2N2YyNzZjcW9jeXloMGp4cmtndiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Rhnxd8fuSqh3PNHudI/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZW0xZHhldWxhc2Jkb2NtZHN1NXFwd3M2b3k4emJ2MWQwaXZqemF5MSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6pUjuQQX9kEfSe604w/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXFjejRub3RldTg4Ym0xa2ZpM29iNDR6d254dXB2bTQ1YTJ5NnU0NyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/I2LrRuh8edGMvWl0mf/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGk4YmU2eDU0NTB1Ym40dHNjZnByeTduZzdxZnpjMDQ5Y3NkMzhvNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/13w5HmyiuaZ224/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWNpeGV4a3FuczFzd3hkZnd6YTRnb3duaWp1eGppM2JjeXdsOHFwYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/be1kDhxjQXrOs0GT2e/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnJ3b2w4aDFyM296anl3N2RvYnZsbnRrbHZjZXlpOGdvNjRjNTVmOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/11tTNkNy1SdXGg/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnJ3b2w4aDFyM296anl3N2RvYnZsbnRrbHZjZXlpOGdvNjRjNTVmOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SehBMWicWhrIKXld5a/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMnJ3b2w4aDFyM296anl3N2RvYnZsbnRrbHZjZXlpOGdvNjRjNTVmOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xT5LMESsx1kUe8Hiyk/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2lrZGZhNGR0cjgzbmtkcTk3aWp6emxlaGk4enB3enJyMWZmZXB2ciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/JSqa30dQmyobgeX10t/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGNvdGIxeDI2eHNlZjJwN2I3aDg2Y295MDUzYjBrcG0wNXJhcGh2MyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/CggoHW4h87Ktq/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGdzeTd6bHp0azVhOWVwb2Y0cGVpZGI2eDAyZTB0YjNubTAxNzF0NCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wloGlwOXKijy8/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGdzeTd6bHp0azVhOWVwb2Y0cGVpZGI2eDAyZTB0YjNubTAxNzF0NCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/iJJ6E58EttmFqgLo96/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTA5eGZxeTVjbngwZ2RkbWpscnJncTdmeGVleWxteml2ZDd0dnNuaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yiEhd1x48BtqEGgoCy/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdzV5bHRpc2gya2Rib2VtMGZleHdsNWIzazhpbnNkd2hhbWVhbjJsYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/in6mnJNYjGKpq/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmg0ZDhvanZqMzJzOGV0cjQybGVkMGh3aHJhaHYwMTcyazhxMDFtciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6yRVg0HWzgS88/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmg0ZDhvanZqMzJzOGV0cjQybGVkMGh3aHJhaHYwMTcyazhxMDFtciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/AjYsTtVxEEBPO/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMm9reXZyMmpoNjF5Z25xd2FhODg0cTFlajhrbnhxczZpOHM0M2FxdCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oAt2dA6LxMkRrGc0g/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOWdtc2xmYWMxaHExODRhcTlxMHRqOGo4bWJwNWJiNWx3Ym05MlwxeCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xT1XGGfuIQuKyHzibS/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGZjY2FobGZtbG51YTB5c3dxMnp2NHA3NnNuaXN4aG8zczM3c2VsbSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/kbHCradRZRDQ3002Pz/giphy.gif"];
const bubbleBathGifs = [ 
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjVueXowMWtzOHl1OW1yd2p0cG5teTZ6Z2JtbzNlb3N4MWlndDFsOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o7525T0t8k7UQjc5O/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZjVueXowMWtzOHl1OW1yd2p0cG5teTZ6Z2JtbzNlb3N4MWlndDFsOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/dhe7aatheWD4Y/giphy.gif",
  "https://media.giphy.com/media/VA6ZhPP3lXGcmFAQQX/giphy.gif?cid=ecf05e4792g0fq9d2vg6bhxqdqj7byya2mc1bhlaxezdsfjm&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/l0HlS1ZlfUzDCZ5iU/giphy.gif?cid=ecf05e473w9imi4rdknwivciv2ez00siz699s7chhjt6ecsn&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/3o6Mb7dQkqugz2pb7G/giphy.gif?cid=ecf05e473w9imi4rdknwivciv2ez00siz699s7chhjt6ecsn&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/1D7lxYJfEdqhADw5pT/giphy.gif?cid=ecf05e472eradanp9pljsyog80eamxgmwkd727nwvzhdw7pg&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/Wmtng8qhGogPArjjzi/giphy.gif?cid=ecf05e47id2og9p9c9rlod64c0kiakxbobtdgv6kej11nzfq&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/0S7p0BflHdefcjRUEj/giphy.gif?cid=ecf05e47nxrp6slb8a0uddx0xew15wvlab85d67sjwbj69dd&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/XpNVb8GlxZLWM/giphy.gif?cid=ecf05e47uf7rfzemj2o6zgi03nuf687z72mckkln52xx489l&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/BwvXHuoU9rbS8/giphy.gif?cid=ecf05e47hmknrkjn48bp82bvpvy5890v2m789nafrtk66vmv&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/KnUrFvGRFyvbaOwq1q/giphy.gif?cid=ecf05e47ae3iipah5ng5fqffz3kxsfodjg248d2gzy6ymrzf&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/l4FAP6LrkZ07TKoBa/giphy.gif?cid=ecf05e472498hxwgksseuti746s91ddy5u7bhtkojide189p&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJleDB1NWwxZnE5ZW90eTV2NWxndWwwNHpzemFwZ3B1eGhsbG8zMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/EVnf7prY7J8Wc/giphy.gif",
  "https://media.giphy.com/media/fg1y0FMMq8Mi4/giphy.gif?cid=ecf05e4701sdip7rlr5cywt47ie5dn5haiwwgne37mngh32v&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/3o6ZsXjyp5af0NdaqA/giphy.gif?cid=ecf05e47nai7wcj8s8ynd3o502o932e0xof7u5eu6818pl6t&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/1qB3EwE3c54A/giphy.gif?cid=ecf05e47g7s1ie55rsn4jkegz0xp5uaet9f65l3iq4xyefel&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/3o7GVKQZJa3RPbYmD6/giphy.gif?cid=ecf05e47h8a7gzk05fsc4djv1zmzwiyd58f39ym3p3lbleo6&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/KfkKJhZAkHxyqfefiq/giphy.gif?cid=ecf05e47649d36gz8yfrki7sibys4fyvpjhm82eu46968b7j&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/cGITc1WexG0R7L3Api/giphy.gif?cid=ecf05e47f97un69mkz2unmff57f4gf2z2jrsgt05yledqz7d&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  "https://media.giphy.com/media/0TNvEshFVlaSHdg7Wc/giphy.gif?cid=ecf05e47ihz3o0itpiu7zms5tqkyjj6m8t9qtbkw3cz5wqrv&ep=v1_gifs_search&rid=giphy.gif&ct=g"];

// COIN AWARD SYSTEM
function calculateCoins(profit) {
  if (profit <= 0) return 0;
  if (profit >= 1501) return 16;
  return Math.min(Math.floor(profit / 100) + 1, 15);
}

function getLeaderboard() {
  return Object.entries(userCoins)
    .map(([userId, coins]) => ({ userId, coins }))
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 5) // Extended to top 5
    .map((entry, index) => {
      const user = client.users.cache.get(entry.userId);
      const username = user ? user.username : 'Unknown User';
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index === 3 ? '4️⃣' : '5️⃣';
      return { username, coins: entry.coins, medal };
    });
}

function setImage(embed, profit) {
  let tier = "0_100";
  if (profit >= 101 && profit <= 200) tier = "101_200";
  else if (profit >= 201 && profit <= 500) tier = "201_500";
  else if (profit >= 501 && profit <= 1000) tier = "501_1000";
  else if (profit >= 1001 && profit <= 1500) tier = "1001_1500";
  else if (profit >= 1501) tier = "1500+";

  const pool = imagePools[tier];
  if (pool.length > 0) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    embed.setImage(pool[randomIndex]);
  }
  return embed;
}

// TIME BOT LOGIC
function schedulePing(cronTime, message) {
  cron.schedule(cronTime, () => {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (channel) {
      channel.send(`@everyone 🔔 ${message}`);
    } else {
      console.error('Channel not found for scheduled ping');
    }
  });
}

// FETCH FUTURES DATA USING ALPHA VANTAGE
async function fetchFuturesData() {
  try {
    console.log('Attempting to fetch futures data from Alpha Vantage...');
    
    // Define the key futures symbols we want to fetch
    const futuresSymbols = [
      { name: 'Gold', symbol: 'GC=F' },
      { name: 'VIX', symbol: 'VX=F' },
      { name: 'E-mini S&P 500', symbol: 'ES=F' },
      { name: 'E-mini NASDAQ-100', symbol: 'NQ=F' }
    ];

    const futures = [];
    
    for (const { name, symbol } of futuresSymbols) {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
      console.log(`Fetching data for ${name} (${symbol}) from ${url}`);
      
      const response = await axios.get(url);
      const data = response.data;
      
      console.log(`Response for ${name}:`, JSON.stringify(data, null, 2));
      
      if (data['Error Message']) {
        console.error(`Error fetching ${name} data:`, data['Error Message']);
        continue;
      }
      
      // Extract the most recent daily data
      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        console.error(`No time series data found for ${name}`);
        continue;
      }
      
      const latestDate = Object.keys(timeSeries)[0]; // Get the most recent date
      const latestData = timeSeries[latestDate];
      
      if (!latestData) {
        console.error(`No latest data found for ${name}`);
        continue;
      }
      
      const last = latestData['4. close'];
      const previousClose = timeSeries[Object.keys(timeSeries)[1]]['4. close'];
      const change = (parseFloat(last) - parseFloat(previousClose)).toFixed(2);
      const percentChange = (((parseFloat(last) - parseFloat(previousClose)) / parseFloat(previousClose)) * 100).toFixed(2) + '%';
      
      futures.push({
        name,
        last,
        change: change > 0 ? `+${change}` : change,
        percentChange: percentChange.startsWith('-') ? percentChange : `+${percentChange}`
      });
    }
    
    console.log('Parsed futures data:', futures);
    return futures.length > 0 ? futures : null;
  } catch (error) {
    console.error('Error fetching futures data from Alpha Vantage:', error.message);
    return null;
  }
}

// REGISTER SLASH COMMANDS
const commands = [
  new SlashCommandBuilder()
    .setName('post')
    .setDescription('Post a message with an optional image.')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('The message to post')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('image')
        .setDescription('URL of the image to include (optional)')
        .setRequired(false))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
})();

// ON READY
client.once('ready', () => {
  console.log(`✅ Combined Bot is online as ${client.user.tag}`);
  schedulePing('55 19 * * 0-4', 'ASIA session starts in 5 minutes!'); // Sunday through Thursday
  schedulePing('55 1 * * 0-5', 'LONDON session starts in 5 minutes!'); // Sunday through Friday
  schedulePing('25 8 * * 0-5', 'NY session starts in 5 minutes!'); // Sunday through Friday
});

// MESSAGE HANDLER FOR TEXT COMMANDS
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const userId = message.author.id;

  // FUTURES COMMAND
  if (command === 'futures') {
    try {
      const futuresData = await fetchFuturesData();
      
      if (!futuresData || futuresData.length === 0) {
        console.log('Futures data is null or empty:', futuresData);
        return message.reply('Failed to fetch futures data from Alpha Vantage. Please try again later. Check console logs for details.');
      }
      
      // Format futures data into a single "box" using a code block
      let futuresBox = '```\n';
      futuresData.forEach(future => {
        const percent = future.percentChange;
        let changeColor = '';
        
        if (percent.startsWith('+')) {
          changeColor = '🟢';
        } else if (percent.startsWith('-')) {
          changeColor = '🔴';
        } else {
          changeColor = '⚪';
        }
        
        futuresBox += `${future.name.padEnd(15)}: ${future.last.padEnd(10)} (${future.change} ${changeColor} ${future.percentChange})\n`;
      });
      futuresBox += '```';
      
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Key Futures Prices')
        .setDescription(futuresBox)
        .setFooter({ text: 'Data from Alpha Vantage | May be delayed' });
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error handling futures command:', error);
      message.reply('An error occurred while fetching futures data.');
    }
    return;
  }

  // BLOWN COMMAND
  if (command === 'blown') {
    blownAccounts++;
    
    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('Account Blown! 💥')
      .setDescription(`${message.author.username} has blown an account!`);
    
    if (blownGifs.length > 0) {
      const randomIndex = Math.floor(Math.random() * blownGifs.length);
      embed.setImage(blownGifs[randomIndex]);
    }
    
    embed.addFields(
      { name: 'Total Blown Accounts', value: blownAccounts.toString(), inline: true },
    );
    
    await message.channel.send({ embeds: [embed] });
    return;
  }

  // BLOWN RESET COMMAND
  if (command === 'blownreset') {
    blownAccounts = 0;
    blownPorts = 0;
    await message.reply('Blown counters have been reset!');
    return;
  }

  // BUBBLE BATH COMMAND
  if (command === 'bubblebath') {
    const embed = new EmbedBuilder()
      .setColor('#00FFFF')
      .setTitle('Bubble Bath Time! 🛁')
      .setDescription(`${message.author.username} is enjoying a relaxing bubble bath!`);
    
    if (bubbleBathGifs.length > 0) {
      const randomIndex = Math.floor(Math.random() * bubbleBathGifs.length);
      embed.setImage(bubbleBathGifs[randomIndex]);
    }
    
    await message.channel.send({ embeds: [embed] });
    return;
  }

  // PROFIT COMMAND
  if (command === 'profit') {
    const amount = parseFloat(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('Please provide a valid profit amount (e.g., !profit 500).');
    }

    if (!userPnL[userId]) userPnL[userId] = { profit: 0, loss: 0 };
    userPnL[userId].profit += amount;

    const coins = calculateCoins(amount);
    if (!userCoins[userId]) userCoins[userId] = 0;
    userCoins[userId] += coins;

    const totalPnL = userPnL[userId].profit - userPnL[userId].loss;

    let embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('Profit Recorded! 💰')
      .setDescription(`${message.author.username} made $${amount.toFixed(2)} profit!`)
      .addFields(
        { name: 'Total Profit', value: `$${userPnL[userId].profit.toFixed(2)} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
        { name: 'Total Loss', value: `$${userPnL[userId].loss.toFixed(2)} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
        { name: 'Coins Earned', value: coins.toString(), inline: true },
        { name: 'Total Coins', value: userCoins[userId].toString(), inline: true }
      );

    embed = setImage(embed, amount);
    
    await message.channel.send({ embeds: [embed] });
    return;
  }

// LOSS COMMAND 
if (command === 'loss') {
  const amount = parseFloat(args[0]);
  if (isNaN(amount) || amount <= 0) {
    return message.reply('Please provide a valid loss amount (e.g., !loss 500).');
  }

  if (!userPnL[userId]) userPnL[userId] = { profit: 0, loss: 0 };
  userPnL[userId].loss += amount;

  const totalPnL = userPnL[userId].profit - userPnL[userId].loss;

  let embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('Loss Recorded! 📉')
    .setDescription(`${message.author.username} lost $${amount.toFixed(2)}!`)
    .addFields(
      { name: 'Total Profit', value: `$${userPnL[userId].profit.toFixed(2)} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
      { name: 'Total Loss', value: `$${userPnL[userId].loss.toFixed(2)} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
      { name: 'Total Coins', value: (userCoins[userId] || 0).toString(), inline: true }
    );

  await message.channel.send({ embeds: [embed] });
  return;
}

  // TIP COMMAND
  if (command === 'tip') {
    const recipient = message.mentions.users.first();
    const amount = parseInt(args[1]);
    
    if (!recipient) {
      return message.reply('Please mention a user to tip (e.g., !tip @user 5).');
    }
    if (isNaN(amount) || amount <= 0) {
      return message.reply('Please provide a valid amount of coins to tip (e.g., !tip @user 5).');
    }
    if (!userCoins[userId] || userCoins[userId] < amount) {
      return message.reply('You don\'t have enough coins to tip!');
    }

    if (!userCoins[recipient.id]) userCoins[recipient.id] = 0;
    userCoins[userId] -= amount;
    userCoins[recipient.id] += amount;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('Coin Tip! 💸')
      .setDescription(`${message.author.username} tipped ${recipient.username} ${amount} coins!`)
      .addFields(
        { name: `${message.author.username}'s Coins`, value: userCoins[userId].toString(), inline: true },
        { name: `${recipient.username}'s Coins`, value: userCoins[recipient.id].toString(), inline: true }
      );

    await message.channel.send({ embeds: [embed] });
    return;
  }

  // BALANCE COMMAND
  if (command === 'balance') {
    const coins = userCoins[userId] || 0;
    const totalPnL = userPnL[userId] ? userPnL[userId].profit - userPnL[userId].loss : 0;
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`${message.author.username}'s Balance`)
      .setDescription(`You have ${coins} coins!`)
      .addFields(
        { name: 'Total Profit', value: `$${userPnL[userId]?.profit.toFixed(2) || 0} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
        { name: 'Total Loss', value: `$${userPnL[userId]?.loss.toFixed(2) || 0} (PnL: $${totalPnL.toFixed(2)})`, inline: false },
        { name: 'Total Coins', value: coins.toString(), inline: true }
      );
    await message.channel.send({ embeds: [embed] });
    return;
  }

  // LEADERBOARD COMMAND
  if (command === 'leaderboard') {
    const leaderboard = getLeaderboard();
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('Coin Leaderboard')
      .setDescription(leaderboard.length > 0 ? leaderboard.map(entry => `${entry.medal} ${entry.username}: ${entry.coins} coins`).join('\n') : 'No rankings yet.')
      .setFooter({ text: 'Top 5 coin holders' });
    await message.channel.send({ embeds: [embed] });
    return;
  }
});

// SLASH COMMAND HANDLER
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'post') {
    const messageContent = interaction.options.getString('message');
    const imageUrl = interaction.options.getString('image');

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Post by ${interaction.user.username}`)
      .setDescription(`@everyone ${messageContent}`)
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    await interaction.reply({ embeds: [embed] });
    return;
  }
});

// LOGIN
client.login(BOT_TOKEN);