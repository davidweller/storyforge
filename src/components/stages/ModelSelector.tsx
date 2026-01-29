'use client';

import { useState, useEffect, useRef } from 'react';
import {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  getEffectiveModelForStage,
  saveModelPreference,
  getModelById,
  type LLMModel,
} from '@/lib/data/models';

interface ModelSelectorProps {
  stage: string;
  onModelChange?: (model: LLMModel) => void;
}

export function ModelSelector({ stage, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Load the effective model on mount
  useEffect(() => {
    const model = getEffectiveModelForStage(stage);
    setSelectedModel(model);
  }, [stage]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelectModel = (model: LLMModel) => {
    setSelectedModel(model);
    saveModelPreference(stage, model.id);
    setIsOpen(false);
    onModelChange?.(model);
  };
  
  if (!selectedModel) return null;
  
  const isOpenAI = selectedModel.provider === 'openai';
  
  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: isOpenAI ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
          border: `1px solid ${isOpenAI ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
          color: isOpenAI ? '#059669' : '#6366f1',
          fontSize: '0.8125rem',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          backgroundColor: isOpenAI ? '#10b981' : '#6366f1' 
        }} />
        {selectedModel.name}
        <svg 
          style={{ 
            width: '0.875rem', 
            height: '0.875rem',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.5rem',
            width: '280px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e5e5e5',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          {/* OpenAI Models */}
          <div style={{ padding: '0.5rem' }}>
            <div style={{ 
              padding: '0.5rem 0.75rem', 
              fontSize: '0.6875rem', 
              fontWeight: 600, 
              color: '#10b981',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <svg style={{ width: '0.875rem', height: '0.875rem' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
              </svg>
              OpenAI
            </div>
            {OPENAI_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelectModel(model)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedModel.id === model.id ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedModel.id !== model.id) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedModel.id !== model.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 500, 
                      color: '#171717',
                      marginBottom: '0.125rem',
                    }}>
                      {model.name}
                      {model.isDefault && (
                        <span style={{ 
                          marginLeft: '0.5rem',
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '4px',
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          fontWeight: 600,
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#737373' }}>
                      {model.description}
                    </div>
                  </div>
                  {selectedModel.id === model.id && (
                    <svg style={{ width: '1rem', height: '1rem', color: '#10b981', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          <div style={{ height: '1px', backgroundColor: '#e5e5e5', margin: '0 0.5rem' }} />
          
          {/* Anthropic Models */}
          <div style={{ padding: '0.5rem' }}>
            <div style={{ 
              padding: '0.5rem 0.75rem', 
              fontSize: '0.6875rem', 
              fontWeight: 600, 
              color: '#6366f1',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <svg style={{ width: '0.875rem', height: '0.875rem' }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.304 3.541l-5.296 16.918H8.399L13.695 3.54h3.609zm-10.608 0l5.296 16.918h3.609L10.305 3.54H6.696z"/>
              </svg>
              Anthropic
            </div>
            {ANTHROPIC_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelectModel(model)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: selectedModel.id === model.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (selectedModel.id !== model.id) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedModel.id !== model.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 500, 
                      color: '#171717',
                      marginBottom: '0.125rem',
                    }}>
                      {model.name}
                      {model.isDefault && (
                        <span style={{ 
                          marginLeft: '0.5rem',
                          fontSize: '0.625rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '4px',
                          backgroundColor: '#6366f1',
                          color: '#ffffff',
                          fontWeight: 600,
                        }}>
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#737373' }}>
                      {model.description}
                    </div>
                  </div>
                  {selectedModel.id === model.id && (
                    <svg style={{ width: '1rem', height: '1rem', color: '#6366f1', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
