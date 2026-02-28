// tests/unit/components.test.jsx
// Basic render tests for all Phase 3 design system components

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Button } from '../../src/components/ui/Button'
import { Input } from '../../src/components/ui/Input'
import { StatusChip } from '../../src/components/shared/StatusChip'
import { ErrorState } from '../../src/components/shared/ErrorState'
import { PageLoader } from '../../src/components/shared/PageLoader'
import { FolderCard } from '../../src/components/shared/FolderCard'
import { DataTable } from '../../src/components/shared/DataTable'

// ─── Button ────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders primary variant', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('renders secondary variant', () => {
    render(<Button variant="secondary">Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn).toBeInTheDocument()
  })

  it('renders destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Menu</Button>)
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Submit</Button>)
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

// ─── Input ─────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email Address" id="email" />)
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<Input placeholder="Enter email" id="email" />)
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Input label="Email" error="Invalid email address" id="email" />)
    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
  })

  it('renders without label gracefully', () => {
    render(<Input id="email" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})

// ─── StatusChip ────────────────────────────────────────────────────────────

describe('StatusChip — reservation', () => {
  const statuses = ['confirmed', 'pending', 'cancelled', 'no_show']
  statuses.forEach(status => {
    it(`renders ${status} status`, () => {
      render(<StatusChip status={status} type="reservation" />)
      // Chip shows human-readable label (underscores replaced with spaces)
      const label = status.replace(/_/g, ' ')
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })
})

describe('StatusChip — payment', () => {
  const statuses = ['paid', 'partial', 'unpaid', 'overpaid', 'failed']
  statuses.forEach(status => {
    it(`renders ${status} payment status`, () => {
      render(<StatusChip status={status} type="payment" />)
      expect(screen.getByText(status)).toBeInTheDocument()
    })
  })
})

// ─── ErrorState ────────────────────────────────────────────────────────────

describe('ErrorState', () => {
  it('renders with default title', () => {
    render(<ErrorState />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders custom title and message', () => {
    render(<ErrorState title="Load failed" message="Could not load reservations." />)
    expect(screen.getByText('Load failed')).toBeInTheDocument()
    expect(screen.getByText('Could not load reservations.')).toBeInTheDocument()
  })

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('does not show retry button when no onRetry', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

// ─── PageLoader ────────────────────────────────────────────────────────────

describe('PageLoader', () => {
  it('renders without crashing', () => {
    const { container } = render(<PageLoader />)
    expect(container.firstChild).toBeInTheDocument()
  })
})

// ─── FolderCard ─────────────────────────────────────────────────────────────

describe('FolderCard', () => {
  it('renders tab label and children', () => {
    render(
      <FolderCard tabLabel="Room 1" color="info">
        <p>Card content</p>
      </FolderCard>
    )
    expect(screen.getByText('Room 1')).toBeInTheDocument()
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('renders with default color', () => {
    render(<FolderCard tabLabel="Suite">Content</FolderCard>)
    expect(screen.getByText('Suite')).toBeInTheDocument()
  })
})

// ─── DataTable ──────────────────────────────────────────────────────────────

describe('DataTable', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'amount', label: 'Amount', numeric: true },
  ]
  const data = [
    { id: '1', name: 'Alice', amount: '$100' },
    { id: '2', name: 'Bob', amount: '$200' },
  ]

  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
  })

  it('renders row data', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows loading skeleton rows when loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} loading />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no data and not loading', () => {
    render(<DataTable columns={columns} data={[]} emptyState={<span>No results</span>} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })
})
