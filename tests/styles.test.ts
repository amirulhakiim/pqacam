import { expect, test } from 'bun:test'

// Ad blockers hide elements by class name. EasyList hides .ad-main, .ad-side, .ad-row and more,
// which once made the whole admin page blank for Adblock Plus users.
test('no CSS class looks like an advertisement to an ad blocker', async () => {
  const css = await Bun.file('src/styles.css').text()
  const classes = [...new Set(css.match(/\.[a-z][\w-]*/g) ?? [])]
  expect(classes.filter((c) => /^\.(ad|ads|advert\w*|banner\w*|sponsor\w*)(-|$)/.test(c))).toEqual([])
})
