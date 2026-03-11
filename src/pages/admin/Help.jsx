// src/pages/admin/Help.jsx
// Setup guide + tools reference + FAQ for innkeepers.

import { useState } from 'react'
import {
  House, Tag, Globe, CalendarCheck, Question,
  CaretDown, CaretUp, ArrowRight, Link as LinkIcon,
  SquaresFour, CalendarBlank, Calendar, DoorOpen, Users,
  CreditCard, ChatCircle, File, ChartBar, Wrench,
  AddressBook, EnvelopeSimple, GearSix,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Section data
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    id: 'property',
    icon: House,
    title: 'Property Basics & Rooms',
    color: 'text-info',
    bgColor: 'bg-info-bg',
    borderColor: 'border-info/30',
    defaultOpen: true,
    steps: [
      {
        title: 'Tell us about your property',
        desc: 'Go to Settings → Property. Fill in your property name, address, and upload a cover photo. This info appears on guest-facing pages.',
        path: '/settings',
        pathLabel: 'Open Settings',
      },
      {
        title: 'Add your rooms',
        desc: 'Go to Rooms → click "Add Room". Enter the room name, type (cabin, suite, etc.), capacity, and a description. You can add photos and amenities per room.',
        path: '/rooms',
        pathLabel: 'Open Rooms',
      },
      {
        title: 'Set room status',
        desc: "Each room can be set Active or Inactive. Inactive rooms won't appear in the booking widget. Use this when a room is under renovation or temporarily unavailable.",
        path: '/rooms',
        pathLabel: 'Open Rooms',
      },
      {
        title: 'Log maintenance issues',
        desc: 'Use the Maintenance page to log issues per room. Mark a log as "block bookings" to prevent that room from being reserved until it\'s resolved.',
        path: '/maintenance',
        pathLabel: 'Open Maintenance',
      },
    ],
  },
  {
    id: 'pricing',
    icon: Tag,
    title: 'Pricing, Taxes & Fees',
    color: 'text-warning',
    bgColor: 'bg-warning-bg',
    borderColor: 'border-warning/30',
    defaultOpen: false,
    steps: [
      {
        title: 'Set a base nightly rate per room',
        desc: "On the Rates page, click the pencil icon next to any room's rate to edit inline. This is the default nightly price before any overrides or fees.",
        path: '/rates',
        pathLabel: 'Open Rates',
      },
      {
        title: 'Add seasonal rate overrides',
        desc: 'Click "+ Add Seasonal Rate" to set a custom rate for a specific date range — perfect for holidays, peak weekends, or slow seasons.',
        path: '/rates',
        pathLabel: 'Open Rates',
      },
      {
        title: 'Add your taxes and fees',
        desc: 'Go to Settings → Pricing. Set your tax rate (%), cleaning fee ($), and pet fee. You can also choose to pass Stripe processing fees to guests.',
        path: '/settings',
        pathLabel: 'Open Settings',
      },
      {
        title: 'Use the pricing calculator',
        desc: 'On the Rates page, expand any room\'s "Calculate" panel. Enter number of nights to see a full breakdown: nightly total, cleaning fee, pet fee, taxes, and Stripe fee.',
        path: '/rates',
        pathLabel: 'Open Rates',
      },
      {
        title: 'Understanding guest pricing',
        desc: 'Guests see a final total at booking. On the guest portal and widget, they can click "Pricing Breakdown" to see the itemized charges (taxes, fees, etc.).',
      },
    ],
  },
  {
    id: 'widget',
    icon: Globe,
    title: 'Booking Widget & Guest Portal',
    color: 'text-success',
    bgColor: 'bg-success-bg',
    borderColor: 'border-success/30',
    defaultOpen: false,
    steps: [
      {
        title: 'Find your widget URL',
        desc: 'Your booking widget lives at /widget?slug=YOUR-PROPERTY-SLUG. Find your slug in Settings → Property. Share this link or embed it on your website.',
        path: '/widget',
        pathLabel: 'Open Widget',
      },
      {
        title: 'Share your rooms browse page',
        desc: 'Guests can also browse your rooms at /browse?slug=YOUR-SLUG — great for linking from social media or your email signature. No commitment required, just a look.',
        path: '/browse',
        pathLabel: 'Open Rooms Browse',
      },
      {
        title: 'Embed the widget on your website',
        desc: 'Add an iframe to your website HTML:\n<iframe src="https://yourdomain.com/widget?slug=YOUR-SLUG" width="100%" height="700" frameborder="0"></iframe>',
      },
      {
        title: 'The guest portal',
        desc: 'Guests can manage their booking at /guest-portal. They enter their confirmation number and email to log in. From there they can view, modify, or cancel their reservation.',
        path: '/guest-portal',
        pathLabel: 'Open Guest Portal',
      },
      {
        title: 'Guest-initiated modifications',
        desc: "When a guest modifies their reservation through the portal, you'll see an alert on the Dashboard under the \"GUEST MODIFIED\" folder. Check it daily to stay informed of any guest-requested changes.",
        path: '/',
        pathLabel: 'Open Dashboard',
      },
      {
        title: 'Messaging guests',
        desc: 'Use the Messaging page to send pre-arrival instructions, check-in codes, or follow-up messages. Templates save time for recurring messages.',
        path: '/messaging',
        pathLabel: 'Open Messaging',
      },
    ],
  },
  {
    id: 'ical',
    icon: CalendarCheck,
    title: 'iCal Sync & Going Live',
    color: 'text-text-secondary',
    bgColor: 'bg-surface',
    borderColor: 'border-border',
    defaultOpen: false,
    steps: [
      {
        title: 'Export your calendar (iCal feed)',
        desc: 'Go to Settings → Integrations. Copy your iCal feed URL. Paste it into Airbnb, VRBO, or any other platform to block dates automatically when you have a reservation here.',
        path: '/settings',
        pathLabel: 'Open Settings',
      },
      {
        title: 'Import external calendars',
        desc: 'Paste an iCal URL from Airbnb or VRBO into Settings → Integrations → "Add External Calendar". Dates from those platforms will appear as blocked on your calendar here.',
        path: '/settings',
        pathLabel: 'Open Settings',
      },
      {
        title: 'Test a booking end-to-end',
        desc: 'Open your widget URL in an incognito window. Make a test reservation with a real email address. Confirm it appears in your Reservations page and the calendar.',
        path: '/reservations',
        pathLabel: 'Open Reservations',
      },
      {
        title: 'Set up payment processing',
        desc: "Connect Stripe in Settings → Payments. Once connected, guests can pay by card at booking. You'll receive payouts on Stripe's standard schedule.",
        path: '/settings',
        pathLabel: 'Open Settings',
      },
      {
        title: "You're live!",
        desc: 'Share your widget link, connect your other booking platforms via iCal, and start taking reservations. Check the Dashboard daily for arrivals, departures, and any guest modifications.',
        path: '/',
        pathLabel: 'Go to Dashboard',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Tools reference data
// ---------------------------------------------------------------------------

const TOOLS = [
  { Icon: SquaresFour, label: 'Dashboard', path: '/', desc: 'Daily snapshot — arrivals, departures, guest modifications, and a 14-day room calendar.' },
  { Icon: CalendarBlank, label: 'Reservations', path: '/reservations', desc: 'Create and manage all bookings. Edit dates, rooms, guest info, and payment status.' },
  { Icon: Calendar, label: 'Calendar', path: '/calendar', desc: 'Visual 14-day room view with color-coded reservations and maintenance blocks.' },
  { Icon: DoorOpen, label: 'Rooms', path: '/rooms', desc: 'Configure rooms — capacity, amenities, photos, buffer days, and room link combinations.' },
  { Icon: Tag, label: 'Rates', path: '/rates', desc: 'Set base nightly rates, seasonal overrides, and preview full guest pricing with the calculator.' },
  { Icon: Users, label: 'Guests', path: '/guests', desc: 'Guest profiles with reservation history, documents, and notes. Search and merge duplicates.' },
  { Icon: CreditCard, label: 'Payments', path: '/payments', desc: 'Track all payments and reconcile with Stripe. View payment status per reservation.' },
  { Icon: ChatCircle, label: 'Messaging', path: '/messaging', desc: 'Send pre-arrival instructions, check-in codes, and follow-up messages from saved templates.' },
  { Icon: File, label: 'Documents', path: '/documents', desc: 'Upload rental agreements and waivers. Attach to guests or reservations, copy shareable links.' },
  { Icon: ChartBar, label: 'Reports', path: '/reports', desc: '12-month financial overview — revenue, ADR, RevPAR, occupancy, and source breakdown.' },
  { Icon: Wrench, label: 'Maintenance', path: '/maintenance', desc: 'Log issues per room, set priority, and block rooms from booking until resolved.' },
  { Icon: AddressBook, label: 'Contacts', path: '/contacts', desc: 'Vendor directory and staff contact list — plumbers, cleaners, and team members.' },
  { Icon: EnvelopeSimple, label: 'Inquiries', path: '/inquiries', desc: 'Guest interest captured from the booking widget when no rooms are available to book.' },
  { Icon: GearSix, label: 'Settings', path: '/settings', desc: 'Property details, pricing defaults, check-in times, Stripe connection, and team management.' },
]

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: 'How do I change my check-in and check-out times?',
    a: 'Go to Settings and update the Check-in Time and Check-out Time fields. These times are shown to guests on confirmation emails and the guest portal.',
  },
  {
    q: 'What are buffer days?',
    a: 'Buffer days block extra time before and after a reservation for cleaning and turnover. Set them per room on the Rooms page. For example, if a room has 1 buffer day after, no new guest can check in the day after a checkout. Buffer days appear as hatched blocks on your calendar.',
  },
  {
    q: 'What are fee overrides on rooms?',
    a: "Fee overrides let you set a different cleaning fee or pet fee for a specific room, instead of using the property-wide default. Leave them blank to use the default from Settings. Useful when larger rooms need higher cleaning fees.",
  },
  {
    q: 'How do room links work?',
    a: 'Room links let you sell a combination of rooms as one listing. First mark rooms as "linkable" on the Rooms page, then create a named combination (like "Family Suite") in the Room Links section. Guests see the linked option in the booking widget alongside individual rooms.',
  },
  {
    q: 'Can guests modify their own reservations?',
    a: "Yes. Guests can modify once through the Guest Portal. The new total must be equal to or greater than the original. If there's a balance due, they'll pay the difference by card. You'll see a \"GUEST MODIFIED\" alert on your Dashboard.",
  },
  {
    q: 'How does iCal sync work?',
    a: 'Each room has a unique iCal feed URL (found in Settings → Integrations). Paste it into Airbnb, VRBO, or Google Calendar to automatically block dates. You can also import external iCal feeds to block dates from other platforms here.',
  },
  {
    q: 'What happens when I cancel a reservation?',
    a: 'The reservation status changes to "cancelled" and the dates become available again. A cancellation email is sent to the guest automatically. Any refunds need to be processed separately through the Payments page or your Stripe dashboard.',
  },
  {
    q: 'How do I handle a third-party booking (someone booking for someone else)?',
    a: "When creating a reservation, fill in the guest info as the person staying, then add a Booker Email for the person who made the booking. You can also add up to 5 CC email addresses. The booker receives confirmations and receipts; CC'd addresses get check-in info.",
  },
  {
    q: 'Why do my Reports show no data?',
    a: 'Reports pull from your actual reservation and payment data. If you just started, you may not have enough history yet. As reservations are completed and payments processed, the reports will populate automatically.',
  },
  {
    q: 'How do I set seasonal pricing?',
    a: 'Go to the Rates page and click "+ Add Seasonal Rate" for any room. Set a date range and a custom nightly rate. Seasonal rates override the base rate for those specific dates — great for holidays, peak weekends, or quiet seasons.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Click "Forgot password?" on the login page and enter your email address. You\'ll receive a link to set a new password. The link expires after 1 hour.',
  },
  {
    q: 'How do I create a new account?',
    a: "On the login page, click \"Don't have an account? Create one\". Enter your property name, email, and a password. You'll be guided through an onboarding flow to set up your property.",
  },
  {
    q: 'How do I add staff members?',
    a: 'Go to Settings → Team. Click "Invite member", enter their email address, and choose a role (manager or staff). Managers can do everything except change settings. Staff have view-only access plus guest, document, messaging, and maintenance management.',
  },
  {
    q: 'What is the Inquiries page?',
    a: 'Inquiries capture guest interest from the booking widget when no rooms are available for their dates. You can update each inquiry\'s status (new → reviewed → contacted → converted or declined) and manually add phone or walk-in inquiries too.',
  },
  {
    q: "How do I print today's arrival checklist?",
    a: 'Go to the Dashboard and click "Print Checklist" in the top-right area. Your browser\'s print dialog will open with a clean, ink-friendly layout of today\'s arrivals and departures.',
  },
  {
    q: 'How do I use the Documents page?',
    a: 'Upload rental agreements, signed waivers, or any guest paperwork. You can attach a document to a specific guest or reservation, open it directly, or copy a shareable link to send by email.',
  },
  {
    q: "What does 'Limited availability' mean on the booking calendar?",
    a: "A yellow date means at least one room is already booked on that night but others are still open. A red strikethrough date means all rooms are taken for that night and the date can't be selected.",
  },
]

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function PhaseStrip() {
  const phases = ['Set Up', 'Go Live', 'Run Your Inn']
  return (
    <div className="flex items-center">
      {phases.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-[6px]">
            <span className="font-mono text-[11px] font-bold text-text-muted">0{i + 1}</span>
            <span className="font-body text-[13px] text-text-secondary">{label}</span>
          </div>
          {i < 2 && <div className="w-6 h-px bg-border mx-1" />}
        </div>
      ))}
    </div>
  )
}

function Step({ step, index }) {
  return (
    <div className="flex gap-4 py-4 border-b border-border last:border-b-0">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-border flex items-center justify-center mt-0.5">
        <span className="font-mono text-[12px] font-bold text-text-muted">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body font-semibold text-[15px] text-text-primary mb-1">{step.title}</p>
        {step.desc.includes('\n') ? (
          <pre className="font-mono text-[12px] text-text-secondary bg-surface px-3 py-2 rounded-[6px] border border-border whitespace-pre-wrap break-all mt-2">
            {step.desc.split('\n').map((line, i) => (
              i === 0
                ? <span key={i} className="font-body text-[13px] not-italic whitespace-normal block mb-2">{line}</span>
                : <code key={i}>{line}</code>
            ))}
          </pre>
        ) : (
          <p className="font-body text-[14px] text-text-secondary leading-relaxed">{step.desc}</p>
        )}
        {step.path && (
          <a
            href={step.path}
            className="inline-flex items-center gap-1 mt-2 font-body text-[13px] text-info hover:underline"
          >
            {step.pathLabel} <ArrowRight size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

function HelpSection({ section }) {
  const [open, setOpen] = useState(section.defaultOpen)
  const Icon = section.icon

  return (
    <div className={cn('rounded-[12px] border overflow-hidden', section.borderColor)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-5 py-4 text-left transition-colors',
          section.bgColor,
          open ? '' : 'hover:opacity-90'
        )}
      >
        <Icon size={20} className={section.color} weight="duotone" />
        <span className={cn('font-heading text-[17px] flex-1', section.color)}>{section.title}</span>
        <span className="flex items-center gap-1 font-body text-[12px] text-text-muted">
          {section.steps.length} step{section.steps.length !== 1 ? 's' : ''}
          {open ? <CaretUp size={13} /> : <CaretDown size={13} />}
        </span>
      </button>

      {open && (
        <div className="px-5 bg-surface-raised">
          {section.steps.map((step, i) => (
            <Step key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolsReference() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-body text-[13px] font-semibold text-text-secondary uppercase tracking-[0.08em]">
          What each page does
        </p>
        <p className="font-body text-[14px] text-text-muted mt-0.5">
          A quick reference for every tool in your sidebar.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TOOLS.map((tool) => (
          <a
            key={tool.path + tool.label}
            href={tool.path}
            className="flex items-start gap-3 p-4 bg-surface-raised border border-border rounded-[10px] hover:border-text-muted transition-colors group"
          >
            <tool.Icon
              size={14}
              weight="fill"
              className="text-text-secondary shrink-0 mt-1 group-hover:text-text-primary transition-colors"
            />
            <div>
              <p className="font-body font-semibold text-[14px] text-text-primary">{tool.label}</p>
              <p className="font-body text-[13px] text-text-secondary leading-snug mt-0.5">{tool.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function FaqSection() {
  const [openIdx, setOpenIdx] = useState(null)

  return (
    <div className="flex flex-col gap-0 border border-border rounded-[12px] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-surface">
        <Question size={20} className="text-info" weight="duotone" />
        <span className="font-heading text-[17px] text-info">Frequently Asked Questions</span>
      </div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border-t border-border">
          <button
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface/50 transition-colors"
          >
            <span className="font-body text-[14px] font-medium text-text-primary flex-1">{item.q}</span>
            {openIdx === i
              ? <CaretUp size={13} className="text-text-muted shrink-0" />
              : <CaretDown size={13} className="text-text-muted shrink-0" />
            }
          </button>
          {openIdx === i && (
            <div className="px-5 pb-4">
              <p className="font-body text-[14px] text-text-secondary leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function Help() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="font-heading text-[32px] text-text-primary uppercase">Help & FAQ</h1>
        <p className="font-body text-[15px] text-text-secondary mt-1">
          {"You're in the right place. Set up takes about 15 minutes — and everything your inn needs lives right here."}
        </p>
      </div>

      {/* Phase strip */}
      <PhaseStrip />

      {/* Setup sections */}
      {SECTIONS.map(section => (
        <HelpSection key={section.id} section={section} />
      ))}

      {/* Tools reference */}
      <ToolsReference />

      {/* FAQ */}
      <FaqSection />

      {/* Footer */}
      <div className="bg-surface-raised border border-border rounded-[12px] px-5 py-4 flex items-start gap-3">
        <LinkIcon size={18} className="text-text-muted shrink-0 mt-0.5" />
        <div>
          <p className="font-body font-semibold text-[14px] text-text-primary mb-0.5">Need more help?</p>
          <p className="font-body text-[13px] text-text-secondary">
            Reach out to us via the contact information in your account settings.
          </p>
        </div>
      </div>
    </div>
  )
}
