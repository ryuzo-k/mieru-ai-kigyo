'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Step1BasicInfo } from './step1-basic-info'
import { Step2BrandDetails } from './step2-brand-details'
import { Step3PromptsGeneration } from './step3-prompts-generation'
import { StoreInfo, Prompt } from '@/types'
import { saveStore, savePrompts, completeSetup, generateId } from '@/lib/storage'

const STEPS = ['基本情報', 'ブランド詳細', 'プロンプト生成']

const defaultStoreInfo: StoreInfo = {
  id: '',
  businessType: 'other',
  name: '',
  websiteUrl: '',
  listingUrls: [],
  description: '',
  targetAudience: '',
  strengths: '',
  services: '',
  achievements: '',
  positioning: '',
  competitors: [],
  createdAt: '',
  updatedAt: '',
}

export function SetupWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo)

  const progress = ((currentStep + 1) / STEPS.length) * 100

  const handleStep1Complete = (data: Partial<StoreInfo>) => {
    setStoreInfo((prev) => ({ ...prev, ...data }))
    setCurrentStep(1)
  }

  const handleStep2Complete = (data: Partial<StoreInfo>) => {
    setStoreInfo((prev) => ({ ...prev, ...data }))
    setCurrentStep(2)
  }

  const handleStep3Complete = (finalPrompts: Prompt[]) => {
    const now = new Date().toISOString()
    const finalStore: StoreInfo = {
      ...storeInfo,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }

    saveStore({ store: finalStore })
    savePrompts(finalPrompts)
    completeSetup()
    router.push('/')
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-start py-8 px-4">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">MiEL for Kigyo</h1>
            <p className="text-sm text-muted-foreground">企業向け初期設定ウィザード</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              ステップ {currentStep + 1} / {STEPS.length}
            </span>
            <span className="font-medium">{STEPS[currentStep]}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((step, index) => (
              <div
                key={step}
                className={`text-xs ${
                  index <= currentStep
                    ? 'text-primary font-medium'
                    : 'text-muted-foreground'
                }`}
              >
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl">
        {currentStep === 0 && (
          <Step1BasicInfo
            initialData={storeInfo}
            onComplete={handleStep1Complete}
          />
        )}
        {currentStep === 1 && (
          <Step2BrandDetails
            storeInfo={storeInfo}
            onComplete={handleStep2Complete}
            onBack={handleBack}
          />
        )}
        {currentStep === 2 && (
          <Step3PromptsGeneration
            storeInfo={storeInfo}
            onComplete={handleStep3Complete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
