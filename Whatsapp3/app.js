const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
var mysql = require('mysql');
const sharp = require('sharp');
var moment = require('moment');
var request = require('request');
const bwipjs = require('bwip-js');
var util = require('util');
var logFile = fs.createWriteStream('log.txt', { flags: 'a' });
  // Or 'w' to truncate the file every time the process starts.
var logStdout = process.stdout;
var qrc = '';
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));
app.use(fileUpload({
  debug: true
}));


const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  session: sessionCfg
});
function GenerateMember(NoHP, NoMember, Nama, caption, callback, message) {
  const width = 750;
  const height = 483;
  const text = Nama;

  const svgImage = `
  <svg width="${width}" height="${height}">
    <style>
    .title { fill: #001; font-size: 30px; font-weight: regular;}
    </style>
    <text x="50%" y="50%" text-anchor="left" class="title">${text}</text>
  </svg>
  `;
  const svgBuffer = Buffer.from(svgImage);
  bwipjs.toBuffer({
    bcid: 'code128',
    text: NoMember,
    scale: 4,
    height: 5,
    includetext: true,
    textxalign: 'left',
    textsize: 8,
  })
    .then(png => {
      sharp('./KartuMember.jpg').composite([{ input: png, top: 450, left: 550 }, { input: svgBuffer, top: 200, left: 175 }]).toFile('MemberJadi.png')
        .then(data => {
          try {
            console.log('[Kartu Dibuat-' + NoMember + '] Kartu berhasil dibuat.');
            const media = new MessageMedia('image/png', fs.readFileSync('./MemberJadi.png', { encoding: 'base64' }), 'MemberJadi.png');
            client.sendMessage(NoHP, media, { caption: caption }).then(response => {
              const media2 = new MessageMedia('text/x-vcard', fs.readFileSync('./Joymart Swalayan.vcf', { encoding: 'base64' }), 'JoymartSwalayan.vcf');
              client.sendMessage(NoHP, media2).then(response1 => {
                client.sendMessage(NoHP, 'Balas *@menu* untuk menampilkan perintah.\r\nBalas *@member* untuk kirim ulang member.\r\nBalas *@promosi* untuk info promo berjalan.');
                return callback(true);
              }).catch(err => {
                return callback(false);
              });
            }).catch(err => {
              return callback(false);
            });
          } catch (error) {
            return callback(false);
          }
        })
        .catch(err => {
          return callback(false);
        });
    })
    .catch(errs => {
      client.sendMessage(NoHP, 'Mohon maaf, member tidak ditemukan.');
      return callback(false), message('Member tidak ditemukan.');
    });
}
function CekMember(field, vaa, callback) {
  axios.get('http://157.230.46.112:3002/api/Member?field=' + field + '&value=' + vaa).then(response => {
    console.log('[Cek Member] Cek Member by ' + field + ' - ' + vaa + '.');
    return callback(response.data);
  })
}
client.on('message', msg => {
  if (msg.body.toUpperCase() == ('@member').toUpperCase()) {
    console.log('[Request @member-' + msg.from + '] Request member diterima.');
    
    CekMember('Ponsel', msg.from.replace('@c.us', '').replace('62', '0'), function (rese) {
      try {
        request.post(
          'http://localhost:8000/member',
          { json: { phone: msg.from, nokartu: rese.NoKartu } },
          function (error, response, body) {
            if (!error && response.statusCode == 200) {
              console.log(body);
            }
          }
        );
      } catch (error) {
        msg.reply('Mohon maaf, nomor whatsapp anda tidak terdaftar di salah satu member kami.\r\n\r\nBalas *@menu* untuk menampilkan perintah.\r\nBalas *@promosi* untuk info promo berjalan.');
        console.log('[Request @member-' + msg.from + '] Member tidak terdaftar.');
      }
    })
  } else if (msg.body.toUpperCase() == ('@promosi').toUpperCase()) {
    console.log('[Request @promosi-' + msg.from + '] Request file promo diterima.');
    var totalf = 0;
    const testFolder = './Catalog/';
    fs.readdirSync(testFolder).forEach(file => {
      let berakhir = file.split(".")[0].split(";")[1]
      if (moment().format('DDMMYY') <= berakhir) {
        const media = new MessageMedia(mime.contentType(file), fs.readFileSync('./Catalog/' + file, { encoding: 'base64' }), file);
        client.sendMessage(msg.from, media, { caption: file.split(".")[0].split(";")[0] });
        totalf = totalf + 1;
        console.log('[Request @promosi-' + msg.from + '] Request file promo mengirim - ' + file.split(".")[0].split(";")[0] + '.');
      }
      console.log('[Request @promosi-' + msg.from + '] Request file promo terkirim.');
    });
    if (totalf < 1) {
      client.sendMessage(msg.from, 'Mohon maaf, perintah *@promosi* sedang tidak tersedia untuk saat ini.\r\nSilahkan coba beberapa saat lagi.');
      console.log('[Request @promosi-' + msg.from + '] Request file promo gagal dikirim.');
    }
  } else if (msg.body.toUpperCase() == ('@menu').toUpperCase()) {
    console.log('[Request @menu-' + msg.from + '] Request menu perintah diterima.');
    client.sendMessage(msg.from, 'Balas *@member* untuk kirim ulang member.\r\nBalas *@promosi* untuk info promo berjalan.');
    console.log('[Request @menu-' + msg.from + '] Request menu perintah dikirim.');
  }

  // Downloading media
  if (msg.hasMedia) {
    msg.downloadMedia().then(media => {
      // To better understanding
      // Please look at the console what data we get
      //console.log(media);

      if (media) {
        // The folder to store: change as you want!
        // Create if not exists
        const mediaPath = './downloaded-media/';

        if (!fs.existsSync(mediaPath)) {
          fs.mkdirSync(mediaPath);
        }

        // Get the file extension by mime-type
        const extension = mime.extension(media.mimetype);

        // Filename: change as you want! 
        // I will use the time for this example
        // Why not use media.filename? Because the value is not certain exists
        const filename = new Date().getTime();

        const fullFilename = mediaPath + filename + '.' + extension;

        // Save to file
        try {
          fs.writeFileSync(fullFilename, media.data, { encoding: 'base64' });
          console.log('File downloaded successfully!', fullFilename);
        } catch (err) {
          console.log('Failed to save the file:', err);
        }
      }
    });
  }
});

client.initialize();

// Socket IO
io.on('connection', function (socket) {
  socket.emit('message', 'Connecting...');
  console.log('[Koneksi] Mencoba terhubung.');

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrc = qr;
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code received, scan please!');
    });
    console.log('[Terhubung-Whatsapp Disconnect] QR Code: ' + qr);
  });

  client.on('ready', () => {
    qrc = '';
    socket.emit('ready', 'Whatsapp is ready!');
    socket.emit('message', 'Whatsapp is ready!');
    console.log('[Terhubung-Ready] Whatsapp terhubung.');
  });

  client.on('authenticated', (session) => {
    qrc = '';
    socket.emit('authenticated', 'Whatsapp is authenticated!');
    socket.emit('message', 'Whatsapp is authenticated!');
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
      if (err) {
        console.error(err);
      }
    });
  });

  client.on('auth_failure', function (session) {
    socket.emit('message', 'Auth failure, restarting...');
    console.log('[Koneksi] Auth failure, restarting...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp is disconnected!');
    /*     fs.unlinkSync(SESSION_FILE_PATH, function(err) {
            if(err) return console.log(err);
            console.log('Session file deleted!');
        }); */
    //client.destroy();
    console.log('[Terhubung-Whatsapp Disconnect] Whatsapp is disconnected!');
    client.initialize();
  });
});
process.on('uncaughtException', err => {
});
const checkRegisteredNumber = async function (number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}
app.post('/check', [
  body('number').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req).formatWith(({
      msg
    }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped()
      });
    }

    const number = phoneNumberFormatter(req.body.number);

    const isRegisteredNumber = await checkRegisteredNumber(number);

    if (!isRegisteredNumber) {
      return res.status(422).json({
        status: false,
        message: 'Nomor tidak terdaftar whatsapp.'
      });
    } else {
      res.status(200).json({
        status: true,
        message: 'Nomor terdaftar di whatsapp.'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Whatsapp tidak terhubung.'
    });
  }
});
app.get('/whatsapp', async (req, res) => {
  try {
    const errors = validationResult(req).formatWith(({
      msg
    }) => {
      return msg;
    });

    if (!errors.isEmpty()) {
      return res.status(422).json({
        status: false,
        message: errors.mapped()
      });
    }
    const number = phoneNumberFormatter('085159937584');

    const isRegisteredNumber = await checkRegisteredNumber(number);

    if (isRegisteredNumber) {
      qrc = '';
      res.status(200).json({
        status: true,
        message: 'Whatsapp terhubung.',
        qrcode: qrc
      });
    }
  } catch (error) {
    res.status(200).json({
      status: false,
      message: 'Whatsapp tidak terhubung.',
      qrcode: qrc
    });
  }
});
app.get('/logout', async (req, res) => {
  try {
    client.logout().then(response => {
      res.status(200).json({
        status: true,
        message: 'Whatsapp berhasil logout.',
        qrcode: qrc
      });
      console.log('[Logout] Whatsapp berhasil logout.');
    }).catch(err => {
      res.status(200).json({
        status: false,
        message: 'Whatsapp tidak login.',
        qrcode: qrc
      });
      console.log('[Logout] Whatsapp belum login.');
    });
    app.get("/system/reboot", (req, res) => {
      process.exit(1)
    })
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Whatsapp gagal logout.',
      qrcode: qrc
    });
    console.log('[Logout] Whatsapp gagal logout.');
  }
});
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(200).json({
      status: false,
      response: { body: errors.mapped() }
    });
  }

  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    console.log('[Kirim Pesan-' + message + '] Gagal mengirim ke ' + number +' (Nomor tidak terdaftar).');
    return res.status(200).json({
      status: false,
      response: { body: 'The number is not registered' }
    });
  }
  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
    console.log('[Kirim Pesan-' + message + '] Berhasil mengirim ke ' + number +'.');
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
    console.log('[Kirim Pesan-' + message + '] Gagal mengirim ke ' + number +'.');
  });
});
// Send media
app.post('/send-file', async (req, res) => {
  const number = phoneNumberFormatter(req.body.number);
  const caption = req.body.caption;

  const file = req.files.file;
  let media;
  if (file.mimetype.toString() == "text/x-vcard") {
    media = file.data.toString();
  } else {
    media = new MessageMedia(file.mimetype, file.data.toString('base64'), file.name);
  }
  client.sendMessage(number, media, {
    caption: caption
  }).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
    console.log('[Kirim File-' + caption + '] Berhasil mengirim ke ' + number +'.');
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
    console.log('[Kirim File-' + caption + '] Gagal mengirim ke ' + number +'.');
  });
});
app.post('/member', async (req, res) => {

  const phone = phoneNumberFormatter(req.body.phone);
  const nokartu = req.body.nokartu;

  let now = new Date();
  let Greeting = (now.getHours() >= 03 & now.getHours() < 10) ? "Selamat Pagi." : (now.getHours() >= 10 & now.getHours() < 14) ? "Selamat Siang." : (now.getHours() >= 14 & now.getHours() < 18) ? "Selamat Malam." : "Selamat Malam.";
  var con = mysql.createConnection({
    host: "joymartku.com",
    user: "joymartk_user",
    password: "704Mart2021",
    database: "joymartk_SUPPORT"
  });
  con.connect();
  try {
    var sql = "SELECT * FROM WhatsappAPI";
    con.query(sql, function (err, results, fields) {
      if (err) throw err;
      ccTemplateA = results[0].TemplateA;
      ccTemplateB = results[0].TemplateB;
      ccTemplateC = results[0].TemplateC;
      ccBatas = results[0].Batas;
      CekMember('NoKartu', nokartu, function (response) {
        try {
          const date = new Date();
          let berakhir = response.TglBerakhir.substring(0, 10).split("-");
          const batas = new Date(date.setDate(date.getDate() + ccBatas));
          GenerateMember(phone, response.NoKartu, response.Nama, ccTemplateA.replace('[NoMember]', response.NoKartu).replace('[Nama]', response.Nama).replace('[Batas]', batas.getDate() + "-" + ('00').substring(0,batas.getMonth().toString().length) + batas.getMonth() + "-" + batas.getFullYear()).replace('[Expired]', berakhir[2] + "-" + berakhir[1] + "-" + berakhir[0]).replace('[Poin]', new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(response.PointAkhir)).replace('[Status]', response.Status).replace('[Greeting]', Greeting), function (response) {
            if (response == true) {
              res.status(200).json({
                status: response,
              });
              console.log('[Member-' + nokartu + '] Berhasil mengirim ke ' + phone +'.');
            } else {
              res.status(500).json({
                status: response,
              });
              console.log('[Member-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
            }
          })
        } catch (error) {
          client.sendMessage(phone, 'Mohon maaf, nomor whatsapp anda tidak tersambung di salah satu member kami.\r\n\r\nBalas *@menu* untuk menampilkan perintah.\r\nBalas *@promosi* untuk info promo berjalan.');
          res.status(500).json({
            status: false,
          });
          console.log('[Member-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
        }
      })
    });
  } catch (err2) {
    console.log("Result: " + err2.message);
    console.log('[Member-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
  }
});
app.post('/ultah', async (req, res) => {

  const phone = phoneNumberFormatter(req.body.phone);
  const nokartu = req.body.nokartu;

  let now = new Date();
  let Greeting = (now.getHours() >= 03 & now.getHours() < 10) ? "Selamat Pagi." : (now.getHours() >= 10 & now.getHours() < 14) ? "Selamat Siang." : (now.getHours() >= 14 & now.getHours() < 18) ? "Selamat Malam." : "Selamat Malam.";
  var con = mysql.createConnection({
    host: "joymartku.com",
    user: "joymartk_user",
    password: "704Mart2021",
    database: "joymartk_SUPPORT"
  });
  con.connect();
  try {
    var sql = "SELECT * FROM WhatsappAPI";
    con.query(sql, function (err, results, fields) {
      if (err) throw err;
      ccTemplateA = results[0].TemplateA;
      ccTemplateB = results[0].TemplateB;
      ccTemplateC = results[0].TemplateC;
      ccBatas = results[0].Batas;
      CekMember('NoKartu', nokartu, function (response) {
        try {
          const date = new Date();
          let berakhir = response.TglBerakhir.substring(0, 10).split("-");
          const batas = new Date(date.setDate(date.getDate() + ccBatas));
          client.sendMessage(phone, ccTemplateB.replace('[NoMember]', response.NoKartu).replace('[Nama]', response.Nama).replace('[Nama]', response.Nama).replace('[Batas]', batas.getDate() + "-" + ('00').substring(0,batas.getMonth().toString().length) + batas.getMonth() + "-" + batas.getFullYear()).replace('[Expired]', berakhir[2] + "-" + berakhir[1] + "-" + berakhir[0]).replace('[Poin]', new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(response.PointAkhir)).replace('[Status]', response.Status).replace('[Greeting]', Greeting)).then(response => {
            res.status(200).json({
              status: true,
              response: response
            });
            client.sendMessage(phone, 'Balas *@menu* untuk menampilkan perintah.\r\nBalas *@member* untuk kirim ulang member.\r\nBalas *@promosi* untuk info promo berjalan.');
            console.log('[Ultah-' + nokartu + '] Berhasil mengirim ke ' + phone +'.');
          }).catch(err => {
            res.status(200).json({
              status: false,
              response: err
            });
            console.log('[Ultah-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
          });
        } catch (error) {
          client.sendMessage(phone, 'Mohon maaf, nomor whatsapp anda tidak tersambung di salah satu member kami.\r\n\r\nBalas *@menu* untuk menampilkan perintah.\r\nBalas *@promosi* untuk info promo berjalan.');
          res.status(500).json({
            status: false,
          });
          console.log('[Ultah-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
        }
      })
    });
  } catch (err2) {
    console.log("Result: " + err2.message);
    console.log('[Ultah-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
  }
});
app.post('/expired', async (req, res) => {

  const phone = phoneNumberFormatter(req.body.phone);
  const nokartu = req.body.nokartu;

  let now = new Date();
  let Greeting = (now.getHours() >= 03 & now.getHours() < 10) ? "Selamat Pagi." : (now.getHours() >= 10 & now.getHours() < 14) ? "Selamat Siang." : (now.getHours() >= 14 & now.getHours() < 18) ? "Selamat Malam." : "Selamat Malam.";
  var con = mysql.createConnection({
    host: "joymartku.com",
    user: "joymartk_user",
    password: "704Mart2021",
    database: "joymartk_SUPPORT"
  });
  con.connect();
  try {
    var sql = "SELECT * FROM WhatsappAPI";
    con.query(sql, function (err, results, fields) {
      if (err) throw err;
      ccTemplateA = results[0].TemplateA;
      ccTemplateB = results[0].TemplateB;
      ccTemplateC = results[0].TemplateC;
      ccBatas = results[0].Batas;
      CekMember('NoKartu', nokartu, function (response) {
        try {
          const date = new Date();
          let berakhir = response.TglBerakhir.substring(0, 10).split("-");
          const batas = new Date(date.setDate(date.getDate() + ccBatas));
          client.sendMessage(phone, ccTemplateC.replace('[NoMember]', response.NoKartu).replace('[Nama]', response.Nama).replace('[Nama]', response.Nama).replace('[Batas]', batas.getDate() + "-" + ('00').substring(0,batas.getMonth().toString().length) + batas.getMonth() + "-" + batas.getFullYear()).replace('[Expired]', berakhir[2] + "-" + berakhir[1] + "-" + berakhir[0]).replace('[Poin]', new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(response.PointAkhir)).replace('[Status]', response.Status).replace('[Greeting]', Greeting).replace('[Batas]', batas)).then(response => {
            res.status(200).json({
              status: true,
              response: response
            });
            client.sendMessage(phone, 'Balas *@menu* untuk menampilkan perintah.\r\nBalas *@member* untuk kirim ulang member.\r\nBalas *@promosi* untuk info promo berjalan.');
            console.log('[Expired-' + nokartu + '] Berhasil mengirim ke ' + phone +'.');
          }).catch(err => {
            res.status(200).json({
              status: false,
              response: err
            });
            console.log('[Expired-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
          });
        } catch (error) {
          client.sendMessage(phone, 'Mohon maaf, nomor whatsapp anda tidak tersambung di salah satu member kami.\r\n\r\nBalas *@menu* untuk menampilkan perintah.\r\nBalas *@promosi* untuk info promo berjalan.');
          res.status(500).json({
            status: false,
          });
          console.log('[Expired-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
        }
      })
    });
  } catch (err2) {
    console.log("Result: " + err2.message);
    console.log('[Expired-' + nokartu + '] Gagal mengirim ke ' + phone +'.');
  }
});
const findGroupByName = async function (name) {
  const group = await client.getChats().then(chats => {
    return chats.find(chat =>
      chat.isGroup && chat.name.toLowerCase() == name.toLowerCase()
    );
  });
  return group;
}

// Send message to group
// You can use chatID or group name, yea!
app.post('/send-group-message', [
  body('id').custom((value, { req }) => {
    if (!value && !req.body.name) {
      throw new Error('Invalid value, you can use `id` or `name`');
    }
    return true;
  }),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  let chatId = req.body.id;
  const groupName = req.body.name;
  const message = req.body.message;

  // Find the group by name
  if (!chatId) {
    const group = await findGroupByName(groupName);
    if (!group) {
      return res.status(422).json({
        status: false,
        message: 'No group found with name: ' + groupName
      });
    }
    chatId = group.id._serialized;
  }

  client.sendMessage(chatId, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});

// Clearing message on spesific chat
app.post('/clear-message', [
  body('number').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = phoneNumberFormatter(req.body.number);

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  const chat = await client.getChatById(number);

  chat.clearMessages().then(status => {
    res.status(200).json({
      status: true,
      response: status
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  })
});
console.log = function () {
  const dt = new Date();
  logFile.write(new Date(dt.setHours(dt.getHours() + 8)).toISOString() + '      ' +  util.format.apply(null, arguments) + '\n');
  logStdout.write(new Date(dt.setHours(dt.getHours())).toISOString() + '      ' + util.format.apply(null, arguments) + '\n');
}
console.error = console.log;
server.listen(port, function () {
  console.log('App running on *: ' + port);
});
