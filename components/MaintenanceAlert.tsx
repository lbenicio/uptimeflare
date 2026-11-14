import { Alert, List, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { MaintenanceConfig, MonitorTarget } from '@/types/config'
import classes from '@/styles/MaintenanceAlert.module.css'

export default function MaintenanceAlert({
  maintenance,
}: {
  maintenance: Omit<MaintenanceConfig, 'monitors'> & { monitors?: MonitorTarget[] }
}) {
  return (
    <Alert
      className={classes.alert}
      icon={<IconAlertTriangle size={18} />}
      title={maintenance.title || 'Scheduled maintenance'}
      color={maintenance.color || 'yellow'}
      withCloseButton={false}
    >
      <Text className={classes.body}>{maintenance.body}</Text>
      <div className={classes.schedule}>
        <span>
          <b>From</b> {new Date(maintenance.start).toLocaleString()}
        </span>
        <span>
          <b>To</b>{' '}
          {maintenance.end ? new Date(maintenance.end).toLocaleString() : 'Until further notice'}
        </span>
      </div>
      {maintenance.monitors && maintenance.monitors.length > 0 && (
        <div className={classes.affected}>
          <Text fw={600} size="xs">
            Affected services
          </Text>
          <List size="xs" withPadding>
            {maintenance.monitors.map((monitor) => (
              <List.Item key={monitor.id}>{monitor.name}</List.Item>
            ))}
          </List>
        </div>
      )}
    </Alert>
  )
}
