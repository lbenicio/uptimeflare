import dynamic from 'next/dynamic'
import { Fragment, ReactNode } from 'react'

const NoSsr = (props: { children: ReactNode }) => <Fragment>{props.children}</Fragment>

export default dynamic(() => Promise.resolve(NoSsr), {
  ssr: false,
})
