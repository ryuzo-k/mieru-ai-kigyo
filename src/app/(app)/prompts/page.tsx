'use client'

import { useEffect, useState } from 'react'
import {
  Plus,
  Star,
  StarOff,
  Pencil,
  Trash2,
  Search,
  Info,
  MessageSquare,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Prompt, PromptCategory, PromptDifficulty, PromptPriority } from '@/types'
import {
  generateId,
} from '@/lib/storage'
import { getPromptsFromDB, savePromptToDB, deletePromptFromDB } from '@/lib/db'
import { useCompany } from '@/context/company-context'
import { cn } from '@/lib/utils'

// ---- constants ----
const categoryLabels: Record<PromptCategory, string> = {
  sales: '売上',
  awareness: 'ブランド認知',
  reputation: 'ブランド毀損',
}

const categoryColors: Record<PromptCategory, string> = {
  sales: 'bg-green-100 text-green-800 border-green-200',
  awareness: 'bg-blue-100 text-blue-800 border-blue-200',
  reputation: 'bg-red-100 text-red-800 border-red-200',
}

const difficultyLabels: Record<PromptDifficulty, string> = {
  low: 'Low',
  med: 'Med',
  high: 'High',
}

const difficultyColors: Record<PromptDifficulty, string> = {
  low: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  med: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
}

const priorityLabels: Record<PromptPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const priorityColors: Record<PromptPriority, string> = {
  high: 'text-red-600 font-semibold',
  medium: 'text-amber-600',
  low: 'text-slate-500',
}

// ---- types ----
type FilterCategory = 'all' | PromptCategory

interface PromptForm {
  text: string
  category: PromptCategory
  difficulty: PromptDifficulty
  priority: PromptPriority
  pseudoMemory: string
}

const defaultForm: PromptForm = {
  text: '',
  category: 'sales',
  difficulty: 'med',
  priority: 'medium',
  pseudoMemory: '',
}

// ---- component ----
export default function PromptsPage() {
  const { companyId } = useCompany()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PromptForm>(defaultForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    getPromptsFromDB(companyId).then(setPrompts).catch(() => {})
  }, [companyId])

  // ---- derived counts ----
  const totalCount = prompts.length
  const winningCount = prompts.filter((p) => p.isWinning).length
  const salesCount = prompts.filter((p) => p.category === 'sales').length
  const awarenessCount = prompts.filter((p) => p.category === 'awareness').length
  const reputationCount = prompts.filter((p) => p.category === 'reputation').length

  // ---- filtered list ----
  const filteredPrompts = prompts.filter((p) => {
    const matchSearch =
      !search || p.text.toLowerCase().includes(search.toLowerCase())
    const matchCategory =
      filterCategory === 'all' || p.category === filterCategory
    return matchSearch && matchCategory
  })

  // Sort: winning first, then by createdAt desc
  const sortedPrompts = [...filteredPrompts].sort((a, b) => {
    if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // ---- dialog handlers ----
  const openCreateDialog = () => {
    setForm(defaultForm)
    setEditingId(null)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (prompt: Prompt) => {
    setForm({
      text: prompt.text,
      category: prompt.category,
      difficulty: prompt.difficulty,
      priority: prompt.priority,
      pseudoMemory: prompt.pseudoMemory,
    })
    setEditingId(prompt.id)
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.text.trim()) {
      setFormError('プロンプトテキストを入力してください')
      return
    }
    setFormError('')
    const now = new Date().toISOString()
    if (editingId) {
      const existing = prompts.find((p) => p.id === editingId)
      if (existing) {
        await savePromptToDB({ ...existing, ...form, updatedAt: now }, companyId)
      }
    } else {
      await savePromptToDB({
        id: generateId(),
        ...form,
        isWinning: false,
        displayRate: undefined,
        citedSources: [],
        citedCompetitors: [],
        citedContext: '',
        createdAt: now,
        updatedAt: now,
      }, companyId)
    }
    const updated = await getPromptsFromDB(companyId)
    setPrompts(updated)
    setDialogOpen(false)
  }

  const handleToggleWinning = async (id: string) => {
    const prompt = prompts.find((p) => p.id === id)
    if (!prompt) return
    await savePromptToDB({ ...prompt, isWinning: !prompt.isWinning, updatedAt: new Date().toISOString() }, companyId)
    const updated = await getPromptsFromDB(companyId)
    setPrompts(updated)
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deletePromptFromDB(deleteId)
    const updated = await getPromptsFromDB(companyId)
    setPrompts(updated)
    setDeleteId(null)
  }

  const deleteTarget = prompts.find((p) => p.id === deleteId)

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ---- Page Header ---- */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">プロンプト管理</h1>
            <p className="text-muted-foreground mt-1">
              計測対象プロンプトの追加・編集・削除。★で勝ち筋プロンプトを設定できます。
            </p>
          </div>
          <Button onClick={openCreateDialog} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            プロンプト追加
          </Button>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-2xl font-bold tabular-nums">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">総プロンプト数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-2xl font-bold tabular-nums text-amber-600">{winningCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">勝ち筋プロンプト</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-2xl font-bold tabular-nums text-green-600">{salesCount + awarenessCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">売上・認知プロンプト</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 px-4">
              <p className="text-2xl font-bold tabular-nums text-red-600">{reputationCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">毀損モニタリング</p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Filters ---- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="プロンプトテキストを検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Category Tabs */}
          <Tabs
            value={filterCategory}
            onValueChange={(v) => setFilterCategory(v as FilterCategory)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">
                全て
                <span className="ml-1.5 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-xs tabular-nums leading-none">
                  {totalCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-xs px-3">
                売上
                <span className="ml-1.5 rounded-full bg-green-100 text-green-700 px-1.5 py-0.5 text-xs tabular-nums leading-none">
                  {salesCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="awareness" className="text-xs px-3">
                ブランド認知
                <span className="ml-1.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-xs tabular-nums leading-none">
                  {awarenessCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="reputation" className="text-xs px-3">
                ブランド毀損
                <span className="ml-1.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-xs tabular-nums leading-none">
                  {reputationCount}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ---- Prompt List ---- */}
        {sortedPrompts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-3">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground opacity-30" />
              {search || filterCategory !== 'all' ? (
                <>
                  <p className="font-medium text-sm text-muted-foreground">
                    条件に一致するプロンプトが見つかりません
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setFilterCategory('all')
                    }}
                  >
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    フィルターをリセット
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm">プロンプトがまだありません</p>
                  <p className="text-xs text-muted-foreground">
                    「プロンプト追加」からGEO計測対象プロンプトを登録しましょう
                  </p>
                  <Button size="sm" onClick={openCreateDialog} className="mt-1">
                    <Plus className="h-4 w-4 mr-2" />
                    最初のプロンプトを追加
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Column header (desktop) */}
            <div className="hidden sm:grid grid-cols-[1.5rem_1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-1.5 text-xs text-muted-foreground font-medium">
              <span />
              <span>プロンプト</span>
              <span className="w-24 text-center">カテゴリ</span>
              <span className="w-16 text-center">難易度</span>
              <span className="w-12 text-center">優先度</span>
              <span className="w-8" />
              <span className="w-16" />
            </div>
            <Separator className="hidden sm:block" />

            {sortedPrompts.map((prompt) => (
              <Card
                key={prompt.id}
                className={cn(
                  'transition-colors',
                  prompt.isWinning
                    ? 'border-amber-300 bg-amber-50/60 hover:bg-amber-50'
                    : 'hover:bg-muted/30'
                )}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    {/* Star toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-7 w-7 p-0 shrink-0 mt-0.5 rounded-md',
                            prompt.isWinning
                              ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-100'
                              : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-50'
                          )}
                          onClick={() => handleToggleWinning(prompt.id)}
                          aria-label={prompt.isWinning ? '勝ち筋を解除' : '勝ち筋に設定'}
                        >
                          {prompt.isWinning ? (
                            <Star className="h-4 w-4 fill-current" />
                          ) : (
                            <StarOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {prompt.isWinning ? '勝ち筋プロンプトから外す' : '勝ち筋プロンプトに設定'}
                      </TooltipContent>
                    </Tooltip>

                    {/* Text + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm leading-snug',
                            prompt.isWinning ? 'font-medium' : ''
                          )}
                        >
                          {prompt.text}
                        </p>
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {/* Category */}
                        <Badge
                          variant="secondary"
                          className={cn('text-xs border', categoryColors[prompt.category])}
                        >
                          {categoryLabels[prompt.category]}
                        </Badge>

                        {/* Difficulty */}
                        <Badge
                          variant="secondary"
                          className={cn('text-xs border', difficultyColors[prompt.difficulty])}
                        >
                          難易度: {difficultyLabels[prompt.difficulty]}
                        </Badge>

                        {/* Priority */}
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded border border-transparent',
                            priorityColors[prompt.priority]
                          )}
                        >
                          優先度:{priorityLabels[prompt.priority]}
                        </span>

                        {/* Display Rate badge */}
                        {prompt.displayRate !== undefined && (
                          <Badge
                            variant="outline"
                            className={cn('text-xs font-semibold border',
                              prompt.displayRate >= 67 ? 'border-green-300 text-green-700 bg-green-50' :
                              prompt.displayRate >= 34 ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
                              'border-slate-300 text-slate-500'
                            )}
                          >
                            表示率 {Math.round(prompt.displayRate)}%
                          </Badge>
                        )}

                        {/* Pseudo memory tooltip */}
                        {prompt.pseudoMemory && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="text-xs cursor-help gap-1 text-slate-600"
                              >
                                <Info className="h-3 w-3" />
                                ユーザーメモリー
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-xs leading-relaxed"
                            >
                              {prompt.pseudoMemory}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(prompt)}
                            aria-label="編集"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">編集</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(prompt.id)}
                            aria-label="削除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">削除</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <p className="text-xs text-muted-foreground text-right pt-1 pr-1">
              {sortedPrompts.length}件表示
              {filterCategory !== 'all' || search ? ` / 全${totalCount}件中` : ''}
            </p>
          </div>
        )}
      </div>

      {/* ---- Create / Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) setFormError('')
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'プロンプトを編集' : 'プロンプトを追加'}
            </DialogTitle>
            <DialogDescription>
              計測対象プロンプトの詳細情報を入力してください
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Text */}
            <div className="space-y-1.5">
              <Label htmlFor="prompt-text" className="text-sm font-medium">
                プロンプトテキスト <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="prompt-text"
                placeholder="例：渋谷でランチにおすすめのイタリアンは？"
                value={form.text}
                onChange={(e) => {
                  setForm({ ...form, text: e.target.value })
                  if (e.target.value.trim()) setFormError('')
                }}
                rows={3}
                className={cn(formError && 'border-destructive focus-visible:ring-destructive')}
              />
              {formError && (
                <p className="text-xs text-destructive">{formError}</p>
              )}
            </div>

            {/* Category / Difficulty / Priority */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">カテゴリ</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as PromptCategory })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                        売上
                      </span>
                    </SelectItem>
                    <SelectItem value="awareness">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                        ブランド認知
                      </span>
                    </SelectItem>
                    <SelectItem value="reputation">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                        ブランド毀損
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">難易度</Label>
                <Select
                  value={form.difficulty}
                  onValueChange={(v) => setForm({ ...form, difficulty: v as PromptDifficulty })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="text-emerald-700">Low（低）</span>
                    </SelectItem>
                    <SelectItem value="med">
                      <span className="text-yellow-700">Med（中）</span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="text-red-700">High（高）</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">優先度</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as PromptPriority })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      <span className="text-red-700 font-semibold">高</span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="text-amber-700">中</span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="text-slate-600">低</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pseudo memory */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="pseudo-memory" className="text-sm font-medium">
                  擬似ユーザーメモリー
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    このプロンプトを検索するユーザーの状況・背景・意図を記述します。
                    AIが文脈を理解するための補足情報です。
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground ml-auto">任意</span>
              </div>
              <Textarea
                id="pseudo-memory"
                placeholder="例：都内在住の30代ビジネスパーソン。平日ランチを検索中。"
                value={form.pseudoMemory}
                onChange={(e) => setForm({ ...form, pseudoMemory: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!form.text.trim()}>
              {editingId ? '変更を保存' : 'プロンプトを追加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete Confirmation ---- */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プロンプトを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">この操作は元に戻せません。</span>
              {deleteTarget && (
                <span className="block rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                  「{deleteTarget.text.length > 60
                    ? deleteTarget.text.substring(0, 60) + '…'
                    : deleteTarget.text}」
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
