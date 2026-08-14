import test from 'node:test'
import assert from 'node:assert/strict'

import { getDefaultButtonValueHint, type InteractiveButtonType } from './WhatsAppMessaging'

test('quick reply values default to a command payload', () => {
  assert.equal(getDefaultButtonValueHint('quick_reply'), 'command_key')
  assert.equal(getDefaultButtonValueHint('cta_url'), 'https://example.com')
})

test('button type list includes supported send-chat types', () => {
  const types: InteractiveButtonType[] = ['cta_url', 'pdf_url', 'cta_copy', 'quick_reply', 'button_call', 'send_whatsapp', 'single_select']
  assert.deepEqual(types, ['cta_url', 'pdf_url', 'cta_copy', 'quick_reply', 'button_call', 'send_whatsapp', 'single_select'])
})
