'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, CheckCircle, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { cn } from '@/lib/utils';
import type { ConnectorDefinition, FamilyMember, IntegrationMethod } from '@allstarfamhub/shared';

type WizardStep = 'select' | 'configure' | 'done';

export default function AddIntegrationPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDefinition | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<IntegrationMethod>('WEB_SCRAPE');

  const { data: connectors, isLoading } = useQuery<ConnectorDefinition[]>({
    queryKey: ['connectors'],
    queryFn: async () => {
      const { data } = await api.get<ConnectorDefinition[]>('/connectors');
      return data;
    },
  });

  const { data: members } = useQuery<FamilyMember[]>({
    queryKey: ['members'],
    queryFn: async () => {
      const { data } = await api.get<FamilyMember[]>('/members');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConnector) return;
      await api.post('/integrations', {
        connectorId: selectedConnector.id,
        memberId: selectedMemberId || undefined,
        method: selectedMethod,
        displayName,
        credentials:
          selectedMethod === 'ICAL_FEED'
            ? { feedUrl }
            : selectedMethod === 'WEB_SCRAPE' || selectedMethod === 'OAUTH_API'
              ? { username, password }
              : undefined,
      });
    },
    onSuccess: () => {
      setStep('done');
    },
  });

  function handleSelectConnector(connector: ConnectorDefinition) {
    setSelectedConnector(connector);
    setDisplayName(`${connector.displayName} Agent`);
    if (connector.methods.length === 1) {
      setSelectedMethod(connector.methods[0] as IntegrationMethod);
    }
    setStep('configure');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/integrations"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Agent</h1>
          <p className="text-sm text-gray-500">
            {step === 'select' && 'Choose a platform to connect'}
            {step === 'configure' && `Configure ${selectedConnector?.displayName}`}
            {step === 'done' && 'Agent created successfully!'}
          </p>
        </div>
      </div>

      {/* Step: Select Connector */}
      {step === 'select' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : connectors && connectors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {connectors
                .filter((c: ConnectorDefinition) => c.isActive)
                .sort((a: ConnectorDefinition, b: ConnectorDefinition) => a.sortOrder - b.sortOrder)
                .map((connector: ConnectorDefinition) => (
                  <button
                    key={connector.id}
                    onClick={() => handleSelectConnector(connector)}
                    className="text-left p-4 rounded-xl border border-gray-200 hover:border-primary/30 hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center flex-shrink-0">
                        <Puzzle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{connector.displayName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{connector.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 ml-auto flex-shrink-0" />
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <Card>
              <div className="text-center py-12 text-gray-400">
                <p>No connectors available yet. Check back soon!</p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Step: Configure */}
      {step === 'configure' && selectedConnector && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="displayName"
              label="Agent Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            {/* Member selection */}
            {members && members.length > 0 && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Assign to Member (optional)
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                >
                  <option value="">Whole family</option>
                  {members.map((m: FamilyMember) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Method selection */}
            {selectedConnector.methods.length > 1 && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Connection Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedConnector.methods.map((method: string) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedMethod(method as IntegrationMethod)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                        selectedMethod === method
                          ? 'border-primary bg-primary-light text-primary'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {method.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Credentials for scrape/oauth */}
            {(selectedMethod === 'WEB_SCRAPE' || selectedMethod === 'OAUTH_API') && (
              <>
                <Input
                  id="username"
                  label="Username / Email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-400">
                  Credentials are encrypted at rest and never shared.
                </p>
              </>
            )}

            {/* Feed URL for iCal */}
            {selectedMethod === 'ICAL_FEED' && (
              <>
                <Input
                  id="feedUrl"
                  label="iCal Feed URL"
                  type="url"
                  placeholder="https://..."
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  required
                />
                {selectedConnector.icalInstructions && (
                  <p className="text-xs text-gray-500">{selectedConnector.icalInstructions}</p>
                )}
              </>
            )}

            {/* Email parse instructions */}
            {selectedMethod === 'EMAIL_PARSE' && selectedConnector.emailInstructions && (
              <div className="p-4 bg-primary-light rounded-lg text-sm text-gray-700">
                {selectedConnector.emailInstructions}
              </div>
            )}

            {createMutation.isError && (
              <div className="p-3 bg-red-50 border border-danger/20 rounded-lg text-sm text-danger">
                Failed to create agent. Please try again.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button type="submit" loading={createMutation.isPending} className="flex-1">
                Create Agent
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card>
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent Created!</h3>
            <p className="text-sm text-gray-500 mb-6">
              Your {selectedConnector?.displayName} agent is now working. It will begin syncing
              events shortly.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => router.push('/integrations')}>
                View All Agents
              </Button>
              <Button
                onClick={() => {
                  setStep('select');
                  setSelectedConnector(null);
                }}
              >
                Add Another
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
