import { useEffect, useState } from 'react'
import {
  Button, Checkbox, Chip, FileInput, Group, Modal, NumberInput, Select, Stepper, Switch, TagsInput, TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CheckCircleIcon, FilePdfIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { useAuth } from './AuthContext'
import {
  clampDailyCount, DAILY_COUNT_MAX, DAILY_COUNT_MIN, EMPTY_PROFILE, JOB_TYPE_OPTIONS, METRO_OPTIONS,
  ROLE_OPTIONS, WORK_AUTH_OPTIONS,
} from '../utils/forYou'
import type { ForYouProfile, WorkAuth } from '../utils/forYou'
import {
  MAX_RESUME_BYTES, fileToRecord, getLocalResumes, setActiveEverywhere, setActiveResumeId,
  uniqueResumeName, upsertLocalResume,
} from '../services/resumeStorage'
import '../styles/ForYou.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  .map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }))
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 8 }, (_, i) => String(THIS_YEAR - 1 + i))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LAST_STEP = 4

interface Props {
  initial: ForYouProfile | null
  defaultEmail: string
  onClose: () => void
  onSave: (p: ForYouProfile) => Promise<{ ok: true } | { ok: false; error: string }>
}

export default function ForYouOnboarding({ initial, defaultEmail, onClose, onSave }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [p, setP] = useState<ForYouProfile>(() => initial ?? { ...EMPTY_PROFILE, email: defaultEmail })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeError, setResumeError] = useState('')
  const [existingResumes, setExistingResumes] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLocalResumes().then(rs => setExistingResumes(rs.map(r => r.name))).catch(() => {})
  }, [])

  const set = <K extends keyof ForYouProfile>(key: K, value: ForYouProfile[K]) =>
    setP(prev => ({ ...prev, [key]: value }))

  // Kept apart from p.gradMonth: it only holds a complete YYYY-MM, so deriving
  // these from it would wipe whichever half the user picks first.
  const [gradYear, setGradYear] = useState(() => p.gradMonth.split('-')[0] ?? '')
  const [gradMon, setGradMon] = useState(() => p.gradMonth.split('-')[1] ?? '')
  const setGrad = (year: string, mon: string) => {
    setGradYear(year)
    setGradMon(mon)
    set('gradMonth', year && mon ? `${year}-${mon}` : '')
  }

  const stepErrors: Record<number, string[]> = {
    0: [
      ...(p.college.trim() ? [] : ['college']),
      ...(p.gradMonth ? [] : ['grad']),
    ],
    1: resumeError ? ['resume'] : [],
    2: [
      ...(p.roles.length ? [] : ['roles']),
      ...(p.jobTypes.length ? [] : ['jobTypes']),
      ...(p.metros.length || p.remoteOk ? [] : ['metros']),
      ...(p.workAuth ? [] : ['workAuth']),
    ],
    3: EMAIL_RE.test(p.email.trim()) ? [] : ['email'],
    4: [],
  }
  const err = (field: string, msg: string) => (touched && stepErrors[step].includes(field) ? msg : undefined)

  const next = () => {
    if (stepErrors[step].length) {
      setTouched(true)
      return
    }
    setTouched(false)
    setStep(s => Math.min(s + 1, LAST_STEP))
  }

  const pickResume = (file: File | null) => {
    setResumeFile(file)
    setResumeError('')
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) setResumeError('Please attach a PDF.')
    else if (file.size > MAX_RESUME_BYTES) setResumeError('Resume must be under 5 MB.')
  }

  const finish = async () => {
    setSaving(true)
    let resumeName = p.resumeName
    if (resumeFile && !resumeError) {
      try {
        const record = fileToRecord(resumeFile)
        record.name = uniqueResumeName(existingResumes, record.name)
        await upsertLocalResume(record)
        if (user) await setActiveEverywhere(user.id, record)
        else await setActiveResumeId(record.id)
        resumeName = record.name
      } catch (e) {
        console.error('Error saving resume from onboarding:', e)
      }
    }
    const res = await onSave({
      ...p,
      college: p.college.trim(),
      email: p.email.trim(),
      phone: p.phone.trim(),
      linkedin: p.linkedin.trim(),
      resumeName,
      completedAt: p.completedAt || new Date().toISOString(),
    })
    setSaving(false)
    if (res.ok) {
      notifications.show({
        title: 'Your For You feed is ready',
        message: p.digestOptIn
          ? `We'll email your top ${p.dailyCount} match${p.dailyCount === 1 ? '' : 'es'} each morning.`
          : 'Open For You on the Internships page to see them.',
        color: 'teal',
        icon: <CheckCircleIcon size={18} weight="fill" />,
      })
    } else {
      notifications.show({
        title: 'Profile saved, but email signup failed',
        message: `${res.error} You can retry from the For You panel.`,
        color: 'orange',
        icon: <WarningCircleIcon size={18} />,
      })
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      size="lg"
      centered
      title={<span className="fy-modal-title">{initial ? 'Edit your For You profile' : 'Set up your feed'}</span>}
      closeOnClickOutside={false}
      classNames={{ content: 'fy-modal' }}
    >
      <p className="fy-modal-sub">
        A few questions so we can surface the internships and new-grad roles that fit you, on the site and, if you want, in one email a day.
      </p>

      <Stepper active={step} onStepClick={i => i < step && setStep(i)} size="xs" className="fy-stepper">
        <Stepper.Step label="Education">
          <div className="fy-step">
            <TextInput
              label="College or university"
              placeholder="e.g. Georgia Institute of Technology"
              value={p.college}
              onChange={e => set('college', e.currentTarget.value)}
              error={err('college', 'Enter your school')}
              autoFocus
            />
            <Group grow align="flex-start">
              <Select
                label="Graduation month"
                placeholder="Month"
                data={MONTHS}
                value={gradMon || null}
                onChange={v => setGrad(gradYear, v ?? '')}
                error={err('grad', 'Pick a month and year')}
              />
              <Select
                label="Graduation year"
                placeholder="Year"
                data={YEARS}
                value={gradYear || null}
                onChange={v => setGrad(v ?? '', gradMon)}
                error={err('grad', ' ')}
              />
            </Group>
          </div>
        </Stepper.Step>

        <Stepper.Step label="Resume">
          <div className="fy-step">
            <FileInput
              label="Attach your resume (PDF)"
              description="Stored in your browser and, when signed in, your private SearchTern cloud folder. Optional."
              placeholder={p.resumeName ? `Current: ${p.resumeName}` : 'Choose a PDF'}
              accept="application/pdf,.pdf"
              leftSection={<FilePdfIcon size={18} />}
              value={resumeFile}
              onChange={pickResume}
              clearable
              error={resumeError || undefined}
            />
          </div>
        </Stepper.Step>

        <Stepper.Step label="Preferences">
          <div className="fy-step">
            <div>
              <div className="fy-label">What kind of roles?</div>
              <Chip.Group multiple value={p.roles} onChange={v => set('roles', v)}>
                <div className="fy-chips">
                  {ROLE_OPTIONS.map(o => <Chip key={o.value} value={o.value} size="sm">{o.label}</Chip>)}
                </div>
              </Chip.Group>
              {err('roles', 'x') && <div className="fy-error">Pick at least one</div>}
            </div>
            <div>
              <div className="fy-label">What type of position?</div>
              <Chip.Group multiple value={p.jobTypes} onChange={v => set('jobTypes', v)}>
                <div className="fy-chips">
                  {JOB_TYPE_OPTIONS.map(o => <Chip key={o.value} value={o.value} size="sm">{o.label}</Chip>)}
                </div>
              </Chip.Group>
              {err('jobTypes', 'x') && <div className="fy-error">Pick at least one</div>}
            </div>
            <TagsInput
              label="Desired locations"
              description="Start typing a major city or metro area"
              placeholder={p.metros.length ? '' : 'e.g. Seattle, New York City'}
              data={METRO_OPTIONS}
              value={p.metros}
              onChange={v => set('metros', v.filter(m => METRO_OPTIONS.includes(m)))}
              maxTags={5}
              limit={8}
              comboboxProps={{ withinPortal: true }}
              error={err('metros', 'Pick a city or allow remote')}
            />
            <Checkbox
              label="Include remote roles"
              checked={p.remoteOk}
              onChange={e => set('remoteOk', e.currentTarget.checked)}
            />
            <Select
              label="Work authorization"
              placeholder="Select one"
              data={WORK_AUTH_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              value={p.workAuth || null}
              onChange={v => set('workAuth', (v ?? '') as WorkAuth)}
              description="If you'll need sponsorship, H-1B sponsors are ranked higher."
              error={err('workAuth', 'Select your work authorization')}
            />
          </div>
        </Stepper.Step>

        <Stepper.Step label="Contact">
          <div className="fy-step">
            <Group grow align="flex-start">
              <TextInput
                label="Email"
                type="email"
                value={p.email}
                onChange={e => set('email', e.currentTarget.value)}
                error={err('email', 'Enter a valid email')}
              />
              <TextInput
                label="Phone"
                type="tel"
                placeholder="Optional"
                value={p.phone}
                onChange={e => set('phone', e.currentTarget.value)}
              />
            </Group>
            <TextInput
              label="LinkedIn"
              placeholder="https://linkedin.com/in/you"
              value={p.linkedin}
              onChange={e => set('linkedin', e.currentTarget.value)}
            />
            <TagsInput
              label="Other links"
              description="GitHub, portfolio, projects you've built. Press Enter after each."
              placeholder="https://github.com/you"
              value={p.links}
              onChange={v => set('links', v)}
              maxTags={6}
            />
          </div>
        </Stepper.Step>

        <Stepper.Step label="Email">
          <div className="fy-step">
            <div className="fy-digest-card">
              <Switch
                size="md"
                checked={p.digestOptIn}
                onChange={e => set('digestOptIn', e.currentTarget.checked)}
                label="Email me my matches each morning"
                description={`Sent to ${user?.email ?? (p.email || 'your email')}. One email a day, only when there's a new match. Unsubscribe any time from the email.`}
              />
              {p.digestOptIn && (
                <NumberInput
                  mt="md"
                  w={150}
                  label="Matches per email"
                  description="1 to 5, best first."
                  min={DAILY_COUNT_MIN}
                  max={DAILY_COUNT_MAX}
                  allowDecimal={false}
                  clampBehavior="strict"
                  value={p.dailyCount}
                  onChange={v => set('dailyCount', clampDailyCount(v))}
                />
              )}
            </div>
          </div>
        </Stepper.Step>
      </Stepper>

      <Group justify="space-between" mt="lg">
        <Button variant="subtle" color="gray" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
          {step === 0 ? (initial ? 'Cancel' : 'Maybe later') : 'Back'}
        </Button>
        {step < LAST_STEP
          ? <Button onClick={next}>Continue</Button>
          : <Button onClick={finish} loading={saving}>Show my matches</Button>}
      </Group>
    </Modal>
  )
}
