'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Calendar,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Check,
  Trash2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getProjectTasksFromDB,
  saveProjectTaskToDB,
  updateProjectTaskInDB,
  deleteProjectTaskFromDB,
  getApiKeysFromDB,
} from '@/lib/db'
import type { ProjectTask } from '@/lib/db'

// ── Color map ──────────────────────────────────────────────────────────────
const TASK_TYPE_COLORS: Record<ProjectTask['taskType'], string> = {
  milestone: 'bg-purple-500 text-white',
  meeting: 'bg-blue-500 text-white',
  deliverable: 'bg-green-500 text-white',
  measurement: 'bg-orange-500 text-white',
  content: 'bg-cyan-500 text-white',
  report: 'bg-gray-500 text-white',
}

const TASK_TYPE_BADGE: Record<ProjectTask['taskType'], string> = {
  milestone: 'bg-purple-100 text-purple-700 border border-purple-200',
  meeting: 'bg-blue-100 text-blue-700 border border-blue-200',
  deliverable: 'bg-green-100 text-green-700 border border-green-200',
  measurement: 'bg-orange-100 text-orange-700 border border-orange-200',
  content: 'bg-cyan-100 text-cyan-700 border border-cyan-200',
  report: 'bg-gray-100 text-gray-700 border border-gray-200',
}

const TASK_TYPE_LABEL: Record<ProjectTask['taskType'], string> = {
  milestone: 'マイルストーン',
  meeting: 'ミーティング',
  deliverable: '成果物',
  measurement: '計測',
  content: 'コンテンツ',
  report: 'レポート',
}

const STATUS_LABEL: Record<ProjectTask['status'], string> = {
  pending: '未着手',
  in_progress: '進行中',
  completed: '完了',
  cancelled: 'キャンセル',
}

const ASSIGNEE_LABEL: Record<ProjectTask['assignee'], string> = {
  us: '我々',
  client: 'クライアント',
  both: '双方',
}

const SERVICE_PACKAGES = [
  { value: 'A', label: 'パッケージA（ライト）' },
  { value: 'B', label: 'パッケージB（スタンダード）' },
  { value: 'C', label: 'パッケージC（プレミアム）' },
  { value: 'full', label: 'フル支援' },
]

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// ── Simple Calendar Component ──────────────────────────────────────────────

function MonthCalendar({
  tasks,
  onSelectTask,
}: {
  tasks: ProjectTask[]
  onSelectTask: (task: ProjectTask) => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const monthLabel = currentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })

  // Group tasks by date string
  const tasksByDate: Record<string, ProjectTask[]> = {}
  for (const task of tasks) {
    const d = task.scheduledDate
    if (!tasksByDate[d]) tasksByDate[d] = []
    tasksByDate[d].push(task)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayNames = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-lg">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {dayNames.map((d) => (
          <div key={d} className="bg-muted text-center text-xs font-medium py-2 text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="bg-background min-h-[80px]" />
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayTasks = tasksByDate[dateStr] || []
          const isToday = dateStr === new Date().toISOString().split('T')[0]
          return (
            <div key={dateStr} className="bg-background min-h-[80px] p-1">
              <div className={`text-xs mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`w-full text-left text-xs px-1 py-0.5 rounded truncate ${TASK_TYPE_COLORS[task.taskType]} opacity-${task.status === 'completed' ? '50' : '90'} hover:opacity-100 transition-opacity`}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-muted-foreground px-1">+{dayTasks.length - 3}件</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Task Detail Modal ──────────────────────────────────────────────────────

function TaskModal({
  task,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: ProjectTask
  onClose: () => void
  onUpdate: (id: string, updates: Partial<ProjectTask>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate)
  const [scheduledTime, setScheduledTime] = useState(task.scheduledTime || '')
  const [status, setStatus] = useState(task.status)
  const [assignee, setAssignee] = useState(task.assignee)
  const [taskType, setTaskType] = useState(task.taskType)
  const [notes, setNotes] = useState(task.notes || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onUpdate(task.id, { title, description, scheduledDate, scheduledTime: scheduledTime || undefined, status, assignee, taskType, notes: notes || undefined })
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('このタスクを削除しますか？')) return
    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
    onClose()
  }

  async function handleStatusChange(newStatus: ProjectTask['status']) {
    setStatus(newStatus)
    await onUpdate(task.id, { status: newStatus })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${TASK_TYPE_BADGE[task.taskType]}`}>
              {TASK_TYPE_LABEL[taskType]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setEditing(!editing)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label>タイトル</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>説明</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>日付</Label>
                  <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>時刻（任意）</Label>
                  <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>タイプ</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as ProjectTask['taskType'])}
                  >
                    {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>担当</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value as ProjectTask['assignee'])}
                  >
                    {Object.entries(ASSIGNEE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>ステータス</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectTask['status'])}
                >
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>メモ</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="補足メモ..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  保存
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">{task.title}</h3>
              <p className="text-sm text-muted-foreground">{task.description}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">日付: </span>
                  <span>{task.scheduledDate}{task.scheduledTime ? ` ${task.scheduledTime}` : ''}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">担当: </span>
                  <span>{ASSIGNEE_LABEL[task.assignee]}</span>
                </div>
              </div>
              {task.notes && (
                <div className="bg-muted rounded p-3 text-sm">
                  <span className="font-medium">メモ: </span>{task.notes}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">ステータスを変更</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(STATUS_LABEL) as [ProjectTask['status'], string][]).map(([s, l]) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                    >
                      {status === s && <Check className="h-3 w-3 inline mr-1" />}
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── New Task Modal ─────────────────────────────────────────────────────────

function NewTaskModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (task: ProjectTask) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0])
  const [scheduledTime, setScheduledTime] = useState('')
  const [taskType, setTaskType] = useState<ProjectTask['taskType']>('milestone')
  const [assignee, setAssignee] = useState<ProjectTask['assignee']>('us')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const task: ProjectTask = {
      id: generateId(),
      title: title.trim(),
      description: description.trim(),
      taskType,
      scheduledDate,
      scheduledTime: scheduledTime || undefined,
      status: 'pending',
      assignee,
      notes: notes.trim() || undefined,
    }
    await onSave(task)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">新規タスク追加</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>タイトル *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タスクタイトル" />
          </div>
          <div className="space-y-2">
            <Label>説明</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="タスクの詳細..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>日付</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>時刻（任意）</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>タイプ</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as ProjectTask['taskType'])}
              >
                {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>担当</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value as ProjectTask['assignee'])}
              >
                {Object.entries(ASSIGNEE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>メモ</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="補足メモ..." />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              追加
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

function SchedulePageInner() {
  const searchParams = useSearchParams()
  const companyId = searchParams.get('company') ?? ''

  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [filterType, setFilterType] = useState<ProjectTask['taskType'] | 'all'>('all')
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)

  // Generate form state
  const [clientName, setClientName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [contractDuration, setContractDuration] = useState(6)
  const [servicePackage, setServicePackage] = useState<'A' | 'B' | 'C' | 'full'>('full')

  useEffect(() => {
    setLoading(true)
    getProjectTasksFromDB(companyId || undefined).then((t) => {
      setTasks(t)
      setLoading(false)
    })
  }, [companyId])

  async function handleGenerate() {
    if (!clientName.trim()) {
      setGenerateError('クライアント名を入力してください')
      return
    }
    setGenerateError('')
    setGenerating(true)
    try {
      const apiKeys = await getApiKeysFromDB(companyId || undefined)
      const res = await fetch('/api/generate-project-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyId || 'company_default',
          startDate,
          contractDurationMonths: contractDuration,
          servicePackage,
          clientName: clientName.trim(),
          clientApiKey: apiKeys.anthropic || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenerateError(data.error || '生成に失敗しました')
        setGenerating(false)
        return
      }
      const generatedTasks: ProjectTask[] = data.tasks
      // Save all tasks to DB
      await Promise.all(generatedTasks.map((t) => saveProjectTaskToDB(t, companyId || undefined)))
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id))
        const newTasks = generatedTasks.filter((t) => !existingIds.has(t.id))
        return [...prev, ...newTasks].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      })
    } catch (e) {
      setGenerateError('生成中にエラーが発生しました: ' + (e as Error).message)
    }
    setGenerating(false)
  }

  async function handleUpdateTask(id: string, updates: Partial<ProjectTask>) {
    await updateProjectTaskInDB(id, updates)
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => prev ? { ...prev, ...updates } : null)
    }
  }

  async function handleDeleteTask(id: string) {
    await deleteProjectTaskFromDB(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleSaveNewTask(task: ProjectTask) {
    await saveProjectTaskToDB(task, companyId || undefined)
    setTasks((prev) =>
      [...prev, task].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    )
  }

  const filteredTasks = filterType === 'all' ? tasks : tasks.filter((t) => t.taskType === filterType)

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">実施スケジュール</h1>
          <p className="text-muted-foreground text-sm mt-1">プロジェクトの実施スケジュールを管理・追跡します</p>
        </div>
        <Button onClick={() => setShowNewTaskModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新規タスク追加
        </Button>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">全体進捗</span>
              <span className="text-sm text-muted-foreground">{completedCount} / {tasks.length} タスク完了 ({progressPct}%)</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">スケジュール自動生成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>クライアント名</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="株式会社◯◯"
              />
            </div>
            <div className="space-y-2">
              <Label>契約開始日</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>契約期間（ヶ月）</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={contractDuration}
                onChange={(e) => setContractDuration(parseInt(e.target.value) || 6)}
              />
            </div>
            <div className="space-y-2">
              <Label>サービスパッケージ</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={servicePackage}
                onChange={(e) => setServicePackage(e.target.value as 'A' | 'B' | 'C' | 'full')}
              >
                {SERVICE_PACKAGES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          {generateError && <p className="text-sm text-destructive">{generateError}</p>}
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                AIがスケジュールを生成中...
              </>
            ) : (
              '契約開始日から標準スケジュールを生成'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* View Toggle & Filter */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'calendar' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Calendar className="h-4 w-4" />
              カレンダー
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${view === 'list' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
              リスト
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterType('all')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              すべて ({tasks.length})
            </button>
            {(Object.entries(TASK_TYPE_LABEL) as [ProjectTask['taskType'], string][]).map(([type, label]) => {
              const count = tasks.filter((t) => t.taskType === type).length
              if (count === 0) return null
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterType === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">スケジュールがまだありません</h3>
            <p className="text-muted-foreground text-sm">上のフォームからAIでスケジュールを自動生成するか、「新規タスク追加」ボタンから手動で追加できます。</p>
          </CardContent>
        </Card>
      ) : view === 'calendar' ? (
        <Card>
          <CardContent className="pt-4">
            <MonthCalendar tasks={filteredTasks} onSelectTask={setSelectedTask} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => setSelectedTask(task)}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_TYPE_COLORS[task.taskType].split(' ')[0]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_TYPE_BADGE[task.taskType]}`}>
                    {TASK_TYPE_LABEL[task.taskType]}
                  </span>
                  <span className={`text-xs ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''} font-medium`}>
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{task.scheduledDate}{task.scheduledTime ? ` ${task.scheduledTime}` : ''}</span>
                  <span>{ASSIGNEE_LABEL[task.assignee]}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                task.status === 'completed' ? 'bg-green-100 text-green-700' :
                task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                task.status === 'cancelled' ? 'bg-gray-100 text-gray-500 line-through' :
                'bg-muted text-muted-foreground'
              }`}>
                {STATUS_LABEL[task.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {(Object.entries(TASK_TYPE_LABEL) as [ProjectTask['taskType'], string][]).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-3 h-3 rounded-sm ${TASK_TYPE_COLORS[type].split(' ')[0]}`} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
      {showNewTaskModal && (
        <NewTaskModal
          onClose={() => setShowNewTaskModal(false)}
          onSave={handleSaveNewTask}
        />
      )}
    </div>
  )
}

export default function SchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <SchedulePageInner />
    </Suspense>
  )
}
