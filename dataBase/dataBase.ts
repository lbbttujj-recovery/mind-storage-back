const dotenv = require('dotenv')
import { Client } from '@notionhq/client'

dotenv.config()

interface Minds {
  id: string
  value: string
  time: number
}

interface Filter {
  from: string
  to: string
}

export const dateToISOFormat = (currentDate: Date) => currentDate.toISOString().split('T')[0]
export const getToday = () => dateToISOFormat(new Date())

class Database {
  private notion
  private mindDBId
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_KEY })
    this.mindDBId = process.env.NOTION_DATABASE_ID || ''
  }

  public async deleteMindNotion(mindId: string) {
    await this.notion.blocks.delete({
      block_id: mindId,
    })
    return 'success'
  }

  public async filterGptMindNotion(query: string): Promise<Minds[]> {
    return [{ value: 'gpt', time: new Date().getTime(), id: '3333333' }]
  }

  public async addMindNotion(mind: string) {
    await this.notion.pages.create({
      parent: { database_id: this.mindDBId },
      properties: {
        Mind: {
          title: [
            {
              text: {
                content: '',
              },
            },
          ],
        },
        Text: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: mind,
              },
            },
          ],
        },
      },
    })

    return 'success'
  }

  public getAllMindsNotion(filter?: Filter): Promise<Minds[]> {
    return new Promise((resolve, rej) => {
      this.notion.databases
        .query({
          database_id: this.mindDBId,
          sorts: [{ property: 'time', direction: 'ascending' }],
          filter: {
            and: [
              {
                property: 'time',
                date: {
                  on_or_after: filter?.from || dateToISOFormat(new Date(0)),
                },
              },
              {
                property: 'time',
                date: {
                  on_or_before: filter?.to || getToday(),
                },
              },
            ],
          },
        })
        .then((res) => {
          const response: Minds[] = []
          res.results.forEach((result) => {
            const id = result.id
            //@ts-ignore
            const value = result.properties.Text.rich_text[0].text.content
            response.push({ value, time: new Date().getTime(), id })
          })
          resolve(response)
        })
        .catch((error) => rej(error))
    })
  }
}

export default Database
