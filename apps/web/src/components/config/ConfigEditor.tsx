import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { Save, AlertCircle, CheckCircle, Clock, Server } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { useThemeStore } from '@/store/theme';
import { relativeTime, getInstanceLabel } from '@/lib/utils';

interface ConfigSnapshot {
  instanceId: string;
  agentType: string;
  content: unknown;
  updatedAt: string;
}

interface ConfigInstance {
  instance_id: string;
  agent_type: string;
  updated_at: string;
  name: string | null;
}

export function ConfigEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const theme = useThemeStore((s) => s.theme);

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configContent, setConfigContent] = useState<string>('{}');
  const [instances, setInstances] = useState<ConfigInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [noConfig, setNoConfig] = useState(false);

  const isLightTheme = theme === 'frost' || theme === 'sakura';

  // Per-theme palette — hand-tuned for each background.
  // sel: selection background. Accent-tinted but with enough grey so text stays
  //      readable on top. Dark themes: mix accent into a mid-tone so the selected
  //      region pops clearly off the near-black base. Light themes: soft tint.
  const syntaxColors = {
    midnight: { sel: '#1e3a5f', key: '#7cc4f8', str: '#8ddb8c', num: '#f0b060', bool: '#c4a5f5', nil: '#f97583', punct: '#8b949e' },
    aurora:   { sel: '#2d2060', key: '#93c5fd', str: '#86efac', num: '#fcd34d', bool: '#d8b4fe', nil: '#fca5a5', punct: '#a0a0c0' },
    cobalt:   { sel: '#1a2d6e', key: '#7eb8f7', str: '#7dd3b0', num: '#fdba74', bool: '#a5b4fc', nil: '#f87171', punct: '#8899bb' },
    copper:   { sel: '#3d2510', key: '#fbbf78', str: '#86efac', num: '#fcd34d', bool: '#e9a8f5', nil: '#fca5a5', punct: '#a08060' },
    ember:    { sel: '#3d2008', key: '#fdba74', str: '#86efac', num: '#fcd34d', bool: '#d8b4fe', nil: '#fca5a5', punct: '#9a8060' },
    neon:     { sel: '#003d4d', key: '#67e8f9', str: '#86efac', num: '#fcd34d', bool: '#d8b4fe', nil: '#f9a8d4', punct: '#7070b0' },
    ocean:    { sel: '#0a3050', key: '#7dd3fc', str: '#6ee7b7', num: '#fde68a', bool: '#c4b5fd', nil: '#fda4af', punct: '#6688aa' },
    phosphor: { sel: '#0a3010', key: '#4ade80', str: '#86efac', num: '#d9f99d', bool: '#bbf7d0', nil: '#fca5a5', punct: '#44884a' },
    rose:     { sel: '#4a1030', key: '#fda4af', str: '#86efac', num: '#fcd34d', bool: '#e9d5ff', nil: '#fca5a5', punct: '#a07080' },
    slate:    { sel: '#1e2e40', key: '#93bbda', str: '#86efac', num: '#fcd34d', bool: '#c4b5fd', nil: '#fca5a5', punct: '#7888a0' },
    frost:    { sel: '#c8d9f5', key: '#0550ae', str: '#0a6640', num: '#953800', bool: '#6f42c1', nil: '#cf222e', punct: '#57606a' },
    sakura:   { sel: '#f5c8d8', key: '#9b1c5e', str: '#0a6640', num: '#953800', bool: '#6f42c1', nil: '#cf222e', punct: '#8a6070' },
  } as const;

  const sc = syntaxColors[theme as keyof typeof syntaxColors] ?? syntaxColors.midnight;

  // Clean up status timer on unmount
  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Load instance list on mount
  useEffect(() => {
    void (async () => {
      try {
        const data = await api.get<{ instances: ConfigInstance[] }>('/config/instances');
        const list = data.instances ?? [];
        setInstances(list);
        if (list.length > 0 && !selectedInstanceId) {
          setSelectedInstanceId(list[0]!.instance_id);
        }
      } catch {
        // ignore — will show no-config state
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConfig = useCallback(async (instanceId?: string) => {
    setIsLoading(true);
    setNoConfig(false);
    try {
      const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
      const snap = await api.get<ConfigSnapshot>(`/config${params}`);
      setSnapshot(snap);

      const content = JSON.stringify(snap.content, null, 2);
      setConfigContent(content);
      if (viewRef.current) {
        viewRef.current.dispatch({
          changes: { from: 0, to: viewRef.current.state.doc.length, insert: content },
        });
      }
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404) {
        setNoConfig(true);
        setConfigContent('{}');
      } else {
        setError('Failed to load configuration');
        setStatus('error');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load config when selectedInstanceId changes
  useEffect(() => {
    void loadConfig(selectedInstanceId || undefined);
  }, [selectedInstanceId, loadConfig]);

  // Build editor — re-creates when theme changes or when content becomes available
  useEffect(() => {
    if (!editorRef.current) return;

    // Selection color: use --color-surface-hover which every theme has hand-tuned
    // for good contrast against its base. This is far more reliable than trying to
    // mix the accent (which varies wildly — cyan, red, green, orange) into the base.
    // For the focused selection we step it up one level brighter.
    // Custom theme using CSS custom properties — integrates with all 12 themes
    const conduitTheme = EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: '14px',
          backgroundColor: 'var(--color-base)',
          color: 'var(--color-text)',
        },
        '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
        '.cm-content': { caretColor: 'var(--color-accent)' },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
        // Selection background — sc.sel is a hand-picked per-theme color.
        // color must be set explicitly here otherwise the browser overrides text
        // color on ::selection in unpredictable ways (often black-on-dark-bg).
        '.cm-selectionBackground': { backgroundColor: sc.sel },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: sc.sel },
        '.cm-content ::selection': { backgroundColor: sc.sel, color: 'var(--color-text)' },
        '.cm-panels': { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' },
        '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--color-border)' },
        '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--color-border)' },
        '.cm-searchMatch': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)',
          outline: '1px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 45%, transparent)',
        },
        // Active line: use surface-hover — already calibrated per theme, clearly
        // distinguishable from base without relying on the accent color
        '.cm-activeLine': { backgroundColor: 'var(--color-surface-hover)' },
        // Other occurrences of selected word
        '.cm-selectionMatch': {
          backgroundColor: sc.sel,
          outline: '1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)',
        },
        '&.cm-focused .cm-matchingBracket': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 28%, var(--color-surface))',
          outline: '1px solid color-mix(in srgb, var(--color-accent) 60%, transparent)',
        },
        '&.cm-focused .cm-nonmatchingBracket': {
          backgroundColor: 'color-mix(in srgb, #ff4444 28%, var(--color-surface))',
          outline: '1px solid rgba(255,68,68,0.5)',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--color-base)',
          color: 'var(--color-muted)',
          borderRight: '1px solid var(--color-border)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'var(--color-surface-hover)',
          color: 'var(--color-text)',
        },
        '.cm-foldPlaceholder': {
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--color-muted)',
        },
        '.cm-tooltip': {
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
        },
        '.cm-tooltip .cm-tooltip-arrow:before': { borderTopColor: 'var(--color-border)', borderBottomColor: 'var(--color-border)' },
        '.cm-tooltip .cm-tooltip-arrow:after': { borderTopColor: 'var(--color-surface)', borderBottomColor: 'var(--color-surface)' },
        '.cm-tooltip-autocomplete': {
          '& > ul > li[aria-selected]': {
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-base)',
          },
        },
      },
      { dark: !isLightTheme },
    );

    // JSON syntax highlighting — per-theme hand-tuned palette
    const conduitHighlight = syntaxHighlighting(
      HighlightStyle.define([
        { tag: tags.propertyName,  color: sc.key },
        { tag: tags.string,        color: sc.str },
        { tag: tags.number,        color: sc.num },
        { tag: tags.bool,          color: sc.bool },
        { tag: tags.null,          color: sc.nil },
        { tag: tags.keyword,       color: sc.bool },
        { tag: tags.punctuation,   color: sc.punct },
        { tag: tags.brace,         color: sc.punct },
        { tag: tags.squareBracket, color: sc.punct },
        { tag: tags.separator,     color: sc.punct },
        { tag: tags.invalid,       color: '#ff4444' },
      ]),
    );

    const extensions = [
      basicSetup,
      json(),
      conduitTheme,
      conduitHighlight,
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: configContent, extensions }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLightTheme, isLoading]);

  async function handleSave() {
    if (!viewRef.current) return;

    const content = viewRef.current.state.doc.toString();

    try {
      JSON.parse(content);
    } catch {
      setStatus('error');
      setError('Invalid JSON. Please fix syntax errors before saving.');
      return;
    }

    setStatus('saving');
    setError('');

    try {
      await api.patch<{ message: string; instanceId: string }>('/config', {
        content,
        ...(selectedInstanceId ? { instanceId: selectedInstanceId } : {}),
      });

      setStatus('saved');
      // Refresh snapshot metadata
      void loadConfig(selectedInstanceId || undefined);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {instances.length > 1 && (
            <>
              <label htmlFor="config-instance" className="sr-only">Select instance</label>
              <Select
                id="config-instance"
                value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="w-52"
            >
              {instances.map((inst) => (
                <option key={inst.instance_id} value={inst.instance_id}>
                  {inst.name ?? inst.instance_id} ({getInstanceLabel(inst.agent_type)})
                </option>
              ))}
            </Select>
            </>
          )}

          {snapshot && (
            <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" aria-hidden="true" />
                {getInstanceLabel(snapshot.agentType)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {relativeTime(snapshot.updatedAt)}
              </span>
            </div>
          )}

          {status === 'error' && (
            <span className="flex items-center gap-1 text-sm text-[var(--color-danger)]" role="alert">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </span>
          )}
          {status === 'saved' && (
            <span className="flex items-center gap-1 text-sm text-[var(--color-success)]" role="status">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Saved & queued — will be applied when the agent starts its next session
            </span>
          )}
        </div>

        <Button onClick={handleSave} disabled={status === 'saving' || noConfig} size="sm">
          <Save className="h-4 w-4" aria-hidden="true" />
          {status === 'saving' ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-4 h-[min(500px,60vh)]">
          <div className="flex gap-2">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-4"
              style={{ width: `${40 + ((i * 37 + 13) % 45)}%` }}
            />
          ))}
        </div>
      ) : noConfig ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-base)]">
          <p className="text-sm font-medium text-[var(--color-text)]">Waiting for first sync</p>
          <p className="text-sm text-[var(--color-muted)] max-w-sm">
            Start a new agent session — the config file will be sent to Conduit automatically on startup.
          </p>
        </div>
      ) : (
        <div
          ref={editorRef}
          className="h-[min(500px,60vh)] overflow-hidden rounded-lg border border-[var(--color-border)]"
        />
      )}
    </div>
  );
}
