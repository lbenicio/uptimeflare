import type { CertificateCheck } from '../../../types/config'

type Status = {
  ping: number
  up: boolean
  err: string
  certificate?: CertificateCheck
}

export type { Status }
