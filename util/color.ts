function getColor(percent: number | string, darker: boolean): string {
  percent = Number(percent)
  if (percent >= 99.9) {
    return darker ? 'var(--status-up)' : 'var(--bar-up)'
  } else if (percent >= 99) {
    return darker ? 'var(--bar-up)' : 'var(--bar-up-muted)'
  } else if (percent >= 95) {
    return 'var(--bar-warning)'
  } else if (Number.isNaN(percent)) {
    return 'var(--bar-neutral)'
  } else {
    return 'var(--bar-down)'
  }
}

export { getColor }
