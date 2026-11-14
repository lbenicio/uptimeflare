import { Container, Group, Text, useMantineColorScheme } from '@mantine/core'
import classes from '@/styles/Header.module.css'
import { pageConfig } from '@/uptime.config'
import { PageConfigLink } from '@/types/config'
import Image from 'next/image'
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'

function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const nextColorScheme = colorScheme === 'auto' ? 'light' : colorScheme === 'light' ? 'dark' : 'auto'
  const label = colorScheme === 'auto' ? 'System' : colorScheme === 'light' ? 'Light' : 'Dark'
  const nextLabel =
    nextColorScheme === 'auto' ? 'System' : nextColorScheme === 'light' ? 'Light' : 'Dark'
  const SchemeIcon =
    colorScheme === 'auto' ? IconDeviceDesktop : colorScheme === 'dark' ? IconMoon : IconSun

  return (
    <button
      type="button"
      className={classes.themeToggle}
      aria-label={`Theme: ${label}. Switch to ${nextLabel}.`}
      title={`Theme: ${label} · click for ${nextLabel}`}
      onClick={() => setColorScheme(nextColorScheme)}
    >
      <SchemeIcon size={16} stroke={1.8} aria-hidden="true" />
      <span className={classes.themeLabel}>{label}</span>
    </button>
  )
}

export default function Header() {
  const linkToElement = (link: PageConfigLink) => {
    return (
      <a
        key={link.label}
        href={link.link}
        target="_blank"
        rel="noreferrer"
        className={classes.link}
        data-active={link.highlight || undefined}
      >
        {link.label}
      </a>
    )
  }

  return (
    <header className={classes.header}>
      <Container fluid={true} className={classes.inner}>
        <div>
          <a
            href="https://github.com/lbenicio/UptimeFlare"
            target="_blank"
            rel="noreferrer"
            className={classes.brand}
          >
            <span className={classes.logo}>
              <Image src="/favicon.ico" alt="" width={23} height={23} />
            </span>
            <span>
              <Text component="span" className={classes.brandName}>
                {pageConfig.title || 'Status page'}
              </Text>
              <Text component="span" className={classes.brandCaption}>
                Service health &amp; uptime
              </Text>
            </span>
          </a>
        </div>

        <div className={classes.navigation}>
          <Group gap={5} visibleFrom="sm">
            {pageConfig.links?.map(linkToElement)}
          </Group>

          <Group gap={5} hiddenFrom="sm">
            {pageConfig.links?.filter((link) => link.highlight).map(linkToElement)}
          </Group>

          <ThemeToggle />
        </div>
      </Container>
    </header>
  )
}
