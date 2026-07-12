export type DashboardStatCard = {
  label: string;
  value: string | number;
  description?: string;
};

export type SystemStatusItem = {
  label: string;
  status: string;
  description?: string;
};

export async function getDashboardStatItems(): Promise<{
  stats: DashboardStatCard[];
  statuses: SystemStatusItem[];
}> {
  return {
    stats: [
      {
        label: 'Parking Lots',
        value: 0,
        description: 'Registered parking lots',
      },
      {
        label: 'Spaces',
        value: 0,
        description: 'Total parking spaces',
      },
      {
        label: 'Active Sessions',
        value: 0,
        description: 'Currently active parking sessions',
      },
      {
        label: 'Today Revenue',
        value: '₩ 0',
        description: 'Collected today',
      },
    ],
    statuses: [
      {
        label: 'API Server',
        status: 'READY',
      },
      {
        label: 'Realtime',
        status: 'READY',
      },
      {
        label: 'Database',
        status: 'READY',
      },
    ],
  };
}