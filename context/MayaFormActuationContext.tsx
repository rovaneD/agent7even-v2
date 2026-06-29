'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { FormFieldSchema, FormSurfaceSnapshot } from '@/lib/maya/formActuation'

type RegisteredSurface = {
  id: string
  label: string
  fields: FormFieldSchema[]
  canonicalWebsite?: string | null
  getValues: () => Record<string, string>
  applyPatch: (patch: Record<string, string>) => void
}

type MayaFormActuationContextValue = {
  hasSurface: boolean
  getSnapshot: () => FormSurfaceSnapshot | null
  applyPatch: (patch: Record<string, string>) => boolean
}

const MayaFormActuationContext = createContext<MayaFormActuationContextValue | null>(null)

const RegisterApiContext = createContext<{
  register: (surface: RegisteredSurface) => void
  unregister: (id: string) => void
} | null>(null)

function buildSnapshot(surface: RegisteredSurface): FormSurfaceSnapshot {
  const values = surface.getValues()
  return {
    id: surface.id,
    label: surface.label,
    canonicalWebsite: surface.canonicalWebsite ?? null,
    fields: surface.fields.map(field => ({
      ...field,
      value: values[field.key] ?? '',
    })),
  }
}

export function MayaFormActuationProvider({ children }: { children: ReactNode }) {
  const surfaceRef = useRef<RegisteredSurface | null>(null)
  const [hasSurface, setHasSurface] = useState(false)

  const register = useCallback((surface: RegisteredSurface) => {
    surfaceRef.current = surface
    setHasSurface(true)
  }, [])

  const unregister = useCallback((id: string) => {
    if (surfaceRef.current?.id !== id) return
    surfaceRef.current = null
    setHasSurface(false)
  }, [])

  const getSnapshot = useCallback((): FormSurfaceSnapshot | null => {
    if (!surfaceRef.current) return null
    return buildSnapshot(surfaceRef.current)
  }, [])

  const applyPatch = useCallback((patch: Record<string, string>) => {
    const surface = surfaceRef.current
    if (!surface || !Object.keys(patch).length) return false
    surface.applyPatch(patch)
    return true
  }, [])

  const value = useMemo(
    () => ({ hasSurface, getSnapshot, applyPatch }),
    [hasSurface, getSnapshot, applyPatch],
  )

  const registerApi = useMemo(
    () => ({ register, unregister }),
    [register, unregister],
  )

  return (
    <MayaFormActuationContext.Provider value={value}>
      <RegisterApiContext.Provider value={registerApi}>
        {children}
      </RegisterApiContext.Provider>
    </MayaFormActuationContext.Provider>
  )
}

export function useMayaFormActuation() {
  return useContext(MayaFormActuationContext)
}

export function useRegisterMayaFormSurface(
  descriptor: {
    id: string
    label: string
    fields: FormFieldSchema[]
    canonicalWebsite?: string | null
  } | null,
  getValues: () => Record<string, string>,
  applyPatchFn: (patch: Record<string, string>) => void,
) {
  const api = useContext(RegisterApiContext)
  const getValuesRef = useRef(getValues)
  const applyPatchRef = useRef(applyPatchFn)
  getValuesRef.current = getValues
  applyPatchRef.current = applyPatchFn

  const fieldsKey = descriptor ? JSON.stringify(descriptor.fields) : ''
  const canonicalKey = descriptor?.canonicalWebsite ?? ''

  useEffect(() => {
    if (!api || !descriptor) return
    api.register({
      ...descriptor,
      getValues: () => getValuesRef.current(),
      applyPatch: patch => applyPatchRef.current(patch),
    })
    return () => api.unregister(descriptor.id)
  }, [api, descriptor?.id, descriptor?.label, fieldsKey, canonicalKey])
}
