'use client'

import { createContext, useContext } from 'react'

interface CompanyContextValue {
  companyId: string
  setCompanyId: (id: string) => void
}

export const CompanyContext = createContext<CompanyContextValue>({
  companyId: 'company_default',
  setCompanyId: () => {},
})

export const useCompany = () => useContext(CompanyContext)
