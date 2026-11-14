import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getColor } from '../../util/color.ts'

describe('availability color thresholds', () => {
  it('uses the up colors at 99.9% and above', () => {
    assert.equal(getColor(100, false), 'var(--bar-up)')
    assert.equal(getColor(99.9, true), 'var(--status-up)')
  })

  it('uses the muted up colors from 99% to below 99.9%', () => {
    assert.equal(getColor('99', false), 'var(--bar-up-muted)')
    assert.equal(getColor(99.5, true), 'var(--bar-up)')
  })

  it('uses warning color from 95% to below 99%', () => {
    assert.equal(getColor(95, false), 'var(--bar-warning)')
    assert.equal(getColor(98.99, true), 'var(--bar-warning)')
  })

  it('uses neutral color for nonnumeric input', () => {
    assert.equal(getColor('not-a-number', false), 'var(--bar-neutral)')
  })

  it('uses down color below 95%', () => {
    assert.equal(getColor(94.99, false), 'var(--bar-down)')
    assert.equal(getColor(-1, true), 'var(--bar-down)')
  })
})
