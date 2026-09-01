/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { ProjectSelect, type Project } from '../ProjectSelect';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    toString: () => '',
  }),
}));

const mockProjects: Project[] = [
  { id: '1', name: 'Project 1' },
  { id: '2', name: 'Project 2' },
];

describe('ProjectSelect Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the selected project name', () => {
    const { getByText } = render(
      <ProjectSelect projects={mockProjects} selectedProjectId="1" />
    );
    expect(getByText('Project 1')).toBeInTheDocument();
  });

  it('opens the dropdown when clicked', () => {
    const { getByRole, getByText } = render(
      <ProjectSelect projects={mockProjects} selectedProjectId="1" />
    );
    const button = getByRole('button');
    fireEvent.click(button);
    expect(getByText('Project 2')).toBeInTheDocument();
  });

  it('calls router.push when an option is clicked', () => {
    const { getByRole, getByText } = render(
      <ProjectSelect projects={mockProjects} selectedProjectId="1" />
    );
    const button = getByRole('button');
    fireEvent.click(button);
    const option = getByText('Project 2');
    fireEvent.click(option);
    expect(mockPush).toHaveBeenCalledWith('?projectId=2');
  });

  it('shows "No projects found" when the list is empty', () => {
    const { getByRole, getByText } = render(
      <ProjectSelect projects={[]} selectedProjectId="" />
    );
    const button = getByRole('button');
    fireEvent.click(button);
    expect(getByText('No projects found')).toBeInTheDocument();
  });
});
