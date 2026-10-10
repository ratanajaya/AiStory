/** @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
import TemplateList from './TemplateList';
const templates = [{ templateId: 't1', name: 'Active template' }, { templateId: 't2', name: 'Inactive template', isActive: false }];
const books = [
  { bookId: 'b1', name: 'Active book', templateId: 't1' },
  { bookId: 'b2', name: 'Inactive book', templateId: 't1', isActive: false },
  { bookId: 'b3', name: 'Hidden book', templateId: 't2' },
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetcher.mockImplementation(async (path: string, options?: { method?: string; body?: string }) => {
    if (options?.method === 'PATCH') return JSON.parse(options.body!);
    return path === '/api/templates' ? templates : books;
  });
});
afterEach(cleanup);
it('places inactive items at the bottom without duplicating books', async () => {
  const user = userEvent.setup();
  render(<TemplateList />);
  await screen.findByText('Active template');
  await user.click(screen.getByRole('button', { name: 'Toggle books for Active template' }));
  await user.click(screen.getByRole('button', { name: 'Toggle books for Inactive template' }));
  const inactive = screen.getByRole('region', { name: 'Inactive' });
  expect(within(inactive).getByText('Inactive template')).toBeTruthy();
  expect(within(inactive).getByText('b2 - Inactive book')).toBeTruthy();
  expect(within(inactive).getByText('b3 - Hidden book')).toBeTruthy();
  expect(screen.getAllByText('b2 - Inactive book')).toHaveLength(1);
  expect(within(inactive).getByText('Hidden while template is inactive')).toBeTruthy();
  expect((within(inactive).getByRole('button', { name: 'New Book' }) as HTMLButtonElement).disabled).toBe(true);
});
it('hides and restores a template without changing independent book statuses', async () => {
  const user = userEvent.setup();
  render(<TemplateList />);
  const name = await screen.findByText('Active template');
  await user.click(screen.getByRole('button', { name: 'Toggle books for Active template' }));
  await user.click(within(name.closest('tr')!).getByRole('button', { name: 'Deactivate' }));
  const inactive = screen.getByRole('region', { name: 'Inactive' });
  expect(within(inactive).getByText('Active template')).toBeTruthy();
  expect(within(inactive).getByText('b1 - Active book')).toBeTruthy();
  expect(screen.getAllByText('b2 - Inactive book')).toHaveLength(1);
  await user.click(within(screen.getByText('Active template').closest('tr')!).getByRole('button', { name: 'Reactivate' }));
  expect(within(inactive).queryByText('b1 - Active book')).toBeNull();
  expect(within(inactive).getByText('b2 - Inactive book')).toBeTruthy();
  expect(mocks.fetcher.mock.calls.filter(([, options]) => options?.method === 'PATCH').map(([path]) => path))
    .toEqual(['/api/templates/t1/status', '/api/templates/t1/status']);
});
it('disables status while saving and preserves placement on failure', async () => {
  const user = userEvent.setup();
  render(<TemplateList />);
  const name = await screen.findByText('Active template');
  let reject!: (reason: Error) => void;
  mocks.fetcher.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  await user.click(within(name.closest('tr')!).getByRole('button', { name: 'Deactivate' }));
  expect((within(name.closest('tr')!).getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error('Failed')));
  await screen.findByRole('alert');
  expect(within(screen.getByRole('region', { name: 'Inactive' })).queryByText('Active template')).toBeNull();
  expect((within(name.closest('tr')!).getByRole('button', { name: 'Deactivate' }) as HTMLButtonElement).disabled).toBe(false);
});
it('moves an individual book to Inactive and restores it from there', async () => {
  const user = userEvent.setup();
  render(<TemplateList />);
  await screen.findByText('Active template');
  await user.click(screen.getByRole('button', { name: 'Toggle books for Active template' }));
  await user.click(within(screen.getByText('b1 - Active book').closest('li')!).getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(within(screen.getByRole('region', { name: 'Inactive' })).getByText('b1 - Active book')).toBeTruthy());
  await user.click(within(screen.getByText('b1 - Active book').closest('li')!).getByRole('button', { name: 'Reactivate' }));
  expect(within(screen.getByRole('region', { name: 'Inactive' })).queryByText('b1 - Active book')).toBeNull();
});
it('loads persisted inactive status on reload', async () => {
  const first = render(<TemplateList />);
  await screen.findByText('Inactive template');
  first.unmount();
  render(<TemplateList />);
  await screen.findByText('Active template');
  expect(within(screen.getByRole('region', { name: 'Inactive' })).getByText('Inactive template')).toBeTruthy();
});
