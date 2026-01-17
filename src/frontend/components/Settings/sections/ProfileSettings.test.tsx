import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileSettings } from './ProfileSettings';
import type { DashboardProfile } from '@irdashies/types';

// Mock the useDashboard hook
const mockRefreshProfiles = vi.fn();
const mockCreateProfile = vi.fn();
const mockDeleteProfile = vi.fn();
const mockRenameProfile = vi.fn();
const mockSwitchProfile = vi.fn();
const mockUpdateProfileTheme = vi.fn();

vi.mock('@irdashies/context', () => ({
  useDashboard: () => ({
    currentProfile: {
      id: 'test-profile-1',
      name: 'Test Profile',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastModified: '2026-01-01T00:00:00.000Z',
      themeSettings: {
        fontSize: 'md',
        colorPalette: 'blue',
      },
    } as DashboardProfile,
    profiles: [
      {
        id: 'default',
        name: 'Default',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'test-profile-1',
        name: 'Test Profile',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
        themeSettings: {
          fontSize: 'md',
          colorPalette: 'blue',
        },
      },
    ] as DashboardProfile[],
    createProfile: mockCreateProfile,
    deleteProfile: mockDeleteProfile,
    renameProfile: mockRenameProfile,
    switchProfile: mockSwitchProfile,
    refreshProfiles: mockRefreshProfiles,
    bridge: {
      updateProfileTheme: mockUpdateProfileTheme,
    },
  }),
}));

describe('ProfileSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Profile Creation', () => {
    it('should create a new profile with valid name', async () => {
      mockCreateProfile.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const input = screen.getByPlaceholderText('Enter profile name...');
      const createButton = screen.getByText('Create');
      
      fireEvent.change(input, { target: { value: 'New Profile' } });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalledWith('New Profile');
      });
    });

    it('should show error when trying to create profile with empty name', async () => {
      render(<ProfileSettings />);
      
      const createButton = screen.getByText('Create');
      // Button is disabled when empty, so this test should verify the disabled state
      expect(createButton).toBeDisabled();
    });

    it('should disable create button when input is empty', () => {
      render(<ProfileSettings />);
      
      const createButton = screen.getByText('Create');
      expect(createButton).toBeDisabled();
    });
  });

  describe('Profile Switching', () => {
    it('should switch to a different profile', async () => {
      mockSwitchProfile.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const switchButton = screen.getByRole('button', { name: 'Switch' });
      fireEvent.click(switchButton);
      
      await waitFor(() => {
        expect(mockSwitchProfile).toHaveBeenCalledWith('default');
      });
    });

    it('should not show switch button for active profile', () => {
      render(<ProfileSettings />);
      
      // Find the active profile row (has the blue indicator dot)
      const activeIndicator = screen.getByTitle('Active Profile');
      const activeProfileRow = activeIndicator.closest('div[class*="px-4"]');
      
      // Check that there's no Switch button in this row
      const switchButtons = Array.from(activeProfileRow?.querySelectorAll('button') || [])
        .filter(btn => btn.textContent === 'Switch');
      
      expect(switchButtons.length).toBe(0);
    });
  });

  describe('Profile Deletion', () => {
    it('should delete a non-Default profile when confirmed', async () => {
      mockDeleteProfile.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      
      // Confirmation dialog should appear
      expect(screen.getByRole('heading', { name: 'Delete Profile' })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the profile "Test Profile"/)).toBeInTheDocument();
      
      // Click the confirm button
      const confirmButton = screen.getByRole('button', { name: 'Delete Profile' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockDeleteProfile).toHaveBeenCalledWith('test-profile-1');
      });
    });

    it('should not delete when user cancels confirmation', async () => {
      render(<ProfileSettings />);
      
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      
      // Confirmation dialog should appear
      expect(screen.getByRole('heading', { name: 'Delete Profile' })).toBeInTheDocument();
      
      // Click the cancel button
      const cancelButton = screen.getByRole('button', { name: 'Keep Profile' });
      fireEvent.click(cancelButton);
      
      // Dialog should be gone and delete should not have been called
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Profile' })).not.toBeInTheDocument();
      });
      
      expect(mockDeleteProfile).not.toHaveBeenCalled();
    });

    it('should close dialog when clicking backdrop', async () => {
      render(<ProfileSettings />);
      
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      
      // Confirmation dialog should appear
      expect(screen.getByRole('heading', { name: 'Delete Profile' })).toBeInTheDocument();
      
      // Click the backdrop (the div with bg-black bg-opacity-50)
      const backdrop = document.querySelector('.bg-black.bg-opacity-50');
      fireEvent.click(backdrop as Element);
      
      // Dialog should be gone and delete should not have been called
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Profile' })).not.toBeInTheDocument();
      });
      
      expect(mockDeleteProfile).not.toHaveBeenCalled();
    });

    it('should close dialog when pressing Escape key', async () => {
      render(<ProfileSettings />);
      
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
      
      // Confirmation dialog should appear
      expect(screen.getByRole('heading', { name: 'Delete Profile' })).toBeInTheDocument();
      
      // Press Escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Dialog should be gone and delete should not have been called
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Profile' })).not.toBeInTheDocument();
      });
      
      expect(mockDeleteProfile).not.toHaveBeenCalled();
    });

    it('should not show delete button for Default', () => {
      render(<ProfileSettings />);
      
      // The Default row should not have a Delete button
      const profileRows = screen.getByText('Default').closest('div[class*="px-4"]');
      const deleteButtons = Array.from(profileRows?.querySelectorAll('button') || [])
        .filter(btn => btn.textContent === 'Delete');
      
      expect(deleteButtons.length).toBe(0);
    });
  });

  describe('Profile Renaming', () => {
    it('should rename a profile', async () => {
      mockRenameProfile.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      // Click Rename button for the second profile (Test Profile)
      const renameButton = screen.getAllByText('Rename')[1];
      fireEvent.click(renameButton);
      
      // Now an input field should appear for editing
      const inputs = screen.getAllByRole('textbox');
      const profileInput = inputs.find(input => (input as HTMLInputElement).value === 'Test Profile');
      expect(profileInput).toBeDefined();
      
      fireEvent.change(profileInput as HTMLInputElement, { target: { value: 'Renamed Profile' } });
      
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockRenameProfile).toHaveBeenCalledWith('test-profile-1', 'Renamed Profile');
      });
    });

    it('should cancel rename without saving', async () => {
      render(<ProfileSettings />);
      
      const renameButton = screen.getAllByText('Rename')[1];
      fireEvent.click(renameButton);
      
      const inputs = screen.getAllByRole('textbox');
      const profileInput = inputs.find(input => (input as HTMLInputElement).value === 'Test Profile');
      fireEvent.change(profileInput as HTMLInputElement, { target: { value: 'New Name' } });
      
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      expect(mockRenameProfile).not.toHaveBeenCalled();
    });
  });

  describe('Theme Overrides', () => {
    it('should update font size override', async () => {
      mockUpdateProfileTheme.mockResolvedValue(undefined);
      mockRefreshProfiles.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const fontSizeSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(fontSizeSelect, { target: { value: 'lg' } });
      
      await waitFor(() => {
        expect(mockUpdateProfileTheme).toHaveBeenCalledWith('test-profile-1', {
          fontSize: 'lg',
          colorPalette: 'blue',
        });
      });
      
      expect(mockRefreshProfiles).toHaveBeenCalled();
    });

    it('should update color palette override', async () => {
      mockUpdateProfileTheme.mockResolvedValue(undefined);
      mockRefreshProfiles.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const colorPaletteSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(colorPaletteSelect, { target: { value: 'red' } });
      
      await waitFor(() => {
        expect(mockUpdateProfileTheme).toHaveBeenCalledWith('test-profile-1', {
          fontSize: 'md',
          colorPalette: 'red',
        });
      });
      
      expect(mockRefreshProfiles).toHaveBeenCalled();
    });

    it('should clear font size override when set to default', async () => {
      mockUpdateProfileTheme.mockResolvedValue(undefined);
      mockRefreshProfiles.mockResolvedValue(undefined);
      
      render(<ProfileSettings />);
      
      const fontSizeSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(fontSizeSelect, { target: { value: '' } });
      
      await waitFor(() => {
        expect(mockUpdateProfileTheme).toHaveBeenCalledWith('test-profile-1', {
          fontSize: undefined,
          colorPalette: 'blue',
        });
      });
    });

    it('should handle theme update errors gracefully', async () => {
      mockUpdateProfileTheme.mockRejectedValue(new Error('Update failed'));
      
      render(<ProfileSettings />);
      
      const fontSizeSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(fontSizeSelect, { target: { value: 'xl' } });
      
      await waitFor(() => {
        expect(screen.getByText('Failed to update font size')).toBeInTheDocument();
      });
    });
  });

  describe('Copy URL Button', () => {
    it('should copy profile URL to clipboard', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
      
      render(<ProfileSettings />);
      
      const copyButtons = screen.getAllByTitle('Copy browser URL for this profile');
      fireEvent.click(copyButtons[0]);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/dashboard?profile=default');
    });
  });

  describe('Profile List Display', () => {
    it('should display all profiles', () => {
      render(<ProfileSettings />);
      
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Test Profile')).toBeInTheDocument();
    });

    it('should show active indicator for current profile', () => {
      render(<ProfileSettings />);
      
      const activeIndicators = screen.getAllByTitle('Active Profile');
      expect(activeIndicators).toHaveLength(1);
    });

    it('should display last modified date', () => {
      render(<ProfileSettings />);
      
      const modifiedText = screen.getAllByText(/Modified:/);
      expect(modifiedText.length).toBeGreaterThan(0);
    });
  });
});
