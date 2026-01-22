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
        className={classes.link}
        data-active={link.highlight}
      >
        {link.label}
      </a>
    )
  }

  return (
    <header className={classes.header} style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
      <Container fluid={true} className={classes.inner}>
        <div>
          <a
            href="https://github.com/lbenicio/UptimeFlare"
            target="_blank"
            style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
          >
            <Image
              src="/favicon.ico"
              alt="Logo"
              width={32}
              height={32}
              style={{ marginRight: '1rem' }}
            />

            <Text
              size="xl"
              span
              fw={700}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 90 }}
            >
              lbenicio status page
            </Text>
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
