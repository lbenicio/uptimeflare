import { Container, Group, Text } from '@mantine/core'
import classes from '@/styles/Header.module.css'
import { pageConfig } from '@/uptime.config'
import { PageConfigLink } from '@/types/config'
import Image from 'next/image'

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

        <Group gap={5} visibleFrom="sm">
          {pageConfig.links?.map(linkToElement)}
        </Group>

        <Group gap={5} hiddenFrom="sm">
          {pageConfig.links?.filter((link) => link.highlight).map(linkToElement)}
        </Group>
      </Container>
    </header>
  )
}
