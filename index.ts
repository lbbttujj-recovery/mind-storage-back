//@ts-nocheck

import { Telegraf, Scenes, Markup, Context, session } from 'telegraf'
import { Stage } from 'telegraf/scenes'

import express from 'express'
import { OpenAI } from 'openai'
import cors from 'cors'
const dotenv = require('dotenv')
import Database, { getToday, dateToISOFormat } from './dataBase/dataBase'
dotenv.config()
import fs from 'fs'
import https from 'https'
import http from 'http'

const addMindScene = new Scenes.BaseScene<Scenes.SceneContext>('ADD_MIND')
const filterScene = new Scenes.BaseScene<Scenes.SceneContext>('FILTER')
const getScene = new Scenes.BaseScene<Scenes.SceneContext>('GET')

const bot = new Telegraf<MyContext>(process.env.TELEGRAM_TOKEN || '')
const db = new Database()
const PORT = 443

const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/lbbttujj.ru/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/lbbttujj.ru/fullchain.pem'),
}

const app = express()
app.use(express.json())
app.use(cors())
const newMindStage = new Stage([addMindScene, filterScene, getScene])

bot.use(session())
// @ts-ignore
bot.use(newMindStage.middleware())

// 1. Определяем интерфейс для сессии
interface SessionData {
  regData?: {
    name?: string
    age?: string
  }
}

// 2. Определяем тип контекста с поддержкой сцен
interface MyContext extends Context {
  session: SessionData
  scene: Scenes.SceneContextScene<any>
}

const mainKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🎲 Рандом', 'random')],
  [Markup.button.callback('🔍 Фильтр', 'filter')],
  [Markup.button.callback('∆ Получить', 'get')],
  [Markup.button.callback('➕ Добавить мысль', 'add')],
])

filterScene
  .enter((ctx) => {
    ctx.reply('Введите критерии фильтрации:', Markup.keyboard(['Отмена']).resize())
  })
  .on('text', async (ctx) => {
    if (ctx.message.text === 'Отмена') {
      await ctx.reply('Фильтрация отменена', Markup.removeKeyboard())
      //@ts-ignore
      return ctx.scene.leave()
    }

    // Здесь реализуйте логику фильтрации
    ctx.reply('Фильтр применен', Markup.removeKeyboard())
    ctx.reply(ctx.text)
    //@ts-ignore
    ctx.scene.leave()
  })

addMindScene
  .enter((ctx) => {
    ctx.reply('Напишите вашу мысль для добавления:', Markup.keyboard(['Отмена']).resize())
  })
  .on('text', async (ctx) => {
    if (ctx.message.text === 'Отмена') {
      await ctx.reply('Действие отменено', Markup.removeKeyboard())
      //@ts-ignore
      return ctx.scene.leave()
    }

    try {
      await db.addMindNotion(ctx.message.text)
      await ctx.reply('Мысль успешно добавлена!', Markup.removeKeyboard())
    } catch (error) {
      await ctx.reply('Ошибка при добавлении мысли', Markup.removeKeyboard())
      console.error(error)
    }
    //@ts-ignore
    ctx.scene.leave()
  })

getScene.enter(async (ctx) => {
  const buttons = [
    [{ text: 'Выбрать период', callback_data: 'period' }],
    [{ text: 'Сегодня', callback_data: 'today' }],
    [{ text: 'За эту неделю', callback_data: 'week' }],
    [{ text: 'За все время', callback_data: 'all' }],
    [{ text: 'Назад', callback_data: 'back' }],
  ]
  await ctx.sendChatAction('typing')
  await ctx.reply('Какие записи?', {
    reply_markup: {
      inline_keyboard: buttons,
    },
  })

  getScene.action(/back/, async (ctx) => {
    await ctx.scene.leave()
    await ctx.reply('ок, еще раз')
  })

  getScene.action(/today/, async (ctx) => {
    db.getAllMindsNotion({ from: getToday(), to: getToday() }).then((res) => {
      res.forEach((value) => {
        ctx.reply(value)
      })
    })
  })

  getScene.action(/week/, async (ctx) => {
    db.getAllMindsNotion({ from: dateToISOFormat(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), to: getToday() }).then((res) => {
      res.forEach((value) => {
        ctx.reply(value)
      })
    })
  })
})

getScene.action(/period/, async (ctx) => {
  await ctx.reply('Пока такого нет')
})

getScene.action(/all/, async (ctx) => {
  db.getAllMindsNotion().then((res) => {
    res.forEach((value) => {
      ctx.reply(value)
    })
  })
})

bot.on('text', (ctx) => {
  const { text } = ctx
  ctx.reply('Выберите действие:', mainKeyboard)
})

bot.action('add', (ctx) => {
  ctx.scene.enter('ADD_MIND')
  ctx.answerCbQuery()
})

bot.action('filter', (ctx) => {
  ctx.scene.enter('FILTER')
  ctx.answerCbQuery()
})

bot.action('get', (ctx) => {
  ctx.scene.enter('GET')
  ctx.answerCbQuery()
})

bot.action('random', (ctx) => {
  db.getAllMindsNotion().then((res) => {
    const length = res.length - 1
    const firstRandom = Math.floor(Math.random() * length)
    let secondRandom = Math.floor(Math.random() * length)
    if (firstRandom === secondRandom) {
      for (let i = 0; i < 3; i++) {
        const currentRand = Math.floor(Math.random() * length)
        if (currentRand !== firstRandom) {
          secondRandom = currentRand
          break
        }
      }
    }
    ctx.reply(res[firstRandom])
    ctx.reply(res[secondRandom])
  })
})

bot.launch(() => {
  console.log('bot launch')
})

app.get('/items/random', (req, res) => {
  db.getAllMindsNotion().then((resolve) => {
    const length = resolve.length - 1
    const firstRandom = Math.floor(Math.random() * length)
    let secondRandom = Math.floor(Math.random() * length)
    if (firstRandom === secondRandom) {
      for (let i = 0; i < 3; i++) {
        const currentRand = Math.floor(Math.random() * length)
        if (currentRand !== firstRandom) {
          secondRandom = currentRand
          break
        }
      }
    }
    const result = [resolve[firstRandom], resolve[secondRandom]]

    res.json(result)
  })
})

app.get('/', (req, res) => {
  res.json('test')
})

app.get('/items', (req, res) => {
  const { period } = req.query
  let from
  let to
  if (period) {
    switch (period) {
      case 'week': {
        from = dateToISOFormat(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        to = getToday()
        break
      }
      case 'today': {
        from = getToday()
        to = getToday()
        break
      }
      default: {
        break
      }
    }
  }

  db.getAllMindsNotion({ to, from }).then((minds) => {
    res.json(minds)
  })
})

app.post('/items', (req, res) => {
  const { value } = req.body
  db.addMindNotion(value)
    .then(() => {
      res.json('success')
    })
    .catch((error) => {
      res.statusCode(500)
    })
})

app.get('/items/search', (req, res) => {
  const searchValue = req.query.q
  db.filterGptMindNotion(searchValue)
    .then((resolve) => {
      res.json(resolve)
    })
    .catch((error) => {
      res.statusCode(500)
    })
})

app.delete('/items', (req, res) => {
  const { id } = req.query
  db.deleteMindNotion(id)
    .then(() => {
      res.json('success')
    })
    .catch((error) => {
      res.statusCode(500)
    })
})

https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS server running on port ${PORT}`)
})

// Редирект HTTP → HTTPS
http
  .createServer((req, res) => {
    res.writeHead(301, { Location: 'https://' + req.headers['host'] + req.url })
    res.end()
  })
  .listen(80)
