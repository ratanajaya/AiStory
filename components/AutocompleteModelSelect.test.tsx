/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AutocompleteModelSelect } from '@/components/AutocompleteModelSelect';
import _constant from '@/utils/_constant';

vi.mock('@/components/AiModelCatalogProvider', () => ({
  useAiModelCatalog: () => ({
    getEntry: (service: string) => ({ models: [{ id: 'same-id', label: service }], loading: false, error: null }),
  }),
}));

afterEach(cleanup);

it('distinguishes providers and offers account inheritance and opt-out', () => {
  const onChange = vi.fn();
  render(<AutocompleteModelSelect value={null} onChange={onChange} modelKeys={_constant.emptyApiKey} inherit />);
  const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Autocomplete model' });
  expect(select.selectedOptions[0].textContent).toBe('Use admin default');
  const openAi = screen.getByRole<HTMLOptionElement>('option', { name: 'openAi (same-id)' });
  const together = screen.getByRole<HTMLOptionElement>('option', { name: 'together (same-id)' });
  expect(openAi.value).not.toBe(together.value);
  fireEvent.change(select, { target: { value: openAi.value } });
  expect(onChange).toHaveBeenLastCalledWith({ model: { service: 'openAi', model: 'same-id' } });
  const refuseless = screen.getByRole<HTMLOptionElement>('option', { name: 'refuseless (same-id)' });
  fireEvent.change(select, { target: { value: refuseless.value } });
  expect(onChange).toHaveBeenLastCalledWith({ model: { service: 'refuseless', model: 'same-id' } });
  fireEvent.change(select, { target: { value: 'off' } });
  expect(onChange).toHaveBeenLastCalledWith({ model: null });
});

it('keeps unavailable saved models and omits inheritance for global defaults', () => {
  render(<AutocompleteModelSelect
    value={{ model: { service: 'together', model: 'saved-model' } }}
    onChange={vi.fn()}
    modelKeys={_constant.emptyApiKey}
  />);
  const select = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Autocomplete model' });
  expect(select.selectedOptions[0].textContent).toBe('saved-model (unavailable)');
  expect(screen.queryByRole('option', { name: 'Use admin default' })).toBeNull();
});
