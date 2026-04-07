import { type FormEvent } from "react";

import type { FieldErrors, Student, WorkflowStepDef } from "../app-types";
import { WorkflowGuide } from "../components/workflow-guide";

type StudentsScreenProps = {
  editingStudentId: string | null;
  studentErrors: FieldErrors;
  studentForm: {
    matricule: string;
    firstName: string;
    lastName: string;
    sex: "M" | "F";
    birthDate: string;
  };
  studentSearch: string;
  studentWorkflowStep: string;
  students: Student[];
  studentsLoading: boolean;
  shownStudents: Student[];
  onDeleteStudent: (studentId: string) => void;
  onEditStudent: (student: Student) => void;
  onResetStudentForm: () => void;
  onSearchChange: (value: string) => void;
  onStudentFormChange: (updater: (previous: StudentsScreenProps["studentForm"]) => StudentsScreenProps["studentForm"]) => void;
  onStudentWorkflowStepChange: (stepId: string) => void;
  onSubmitStudent: (event: FormEvent<HTMLFormElement>) => void;
  renderFieldError: (errors: FieldErrors, field: string) => JSX.Element | null;
};

export function StudentsScreen(props: StudentsScreenProps): JSX.Element {
  const {
    editingStudentId,
    onDeleteStudent,
    onEditStudent,
    onResetStudentForm,
    onSearchChange,
    onStudentFormChange,
    onStudentWorkflowStepChange,
    onSubmitStudent,
    renderFieldError,
    shownStudents,
    studentErrors,
    studentForm,
    studentSearch,
    studentWorkflowStep,
    students,
    studentsLoading
  } = props;

  const studentSteps: WorkflowStepDef[] = [
    {
      id: "entry",
      title: editingStudentId ? "Edition du dossier" : "Nouveau dossier",
      hint: "Renseigner les informations d'identite de l'eleve."
    },
    {
      id: "list",
      title: "Base eleves",
      hint: "Filtrer, verifier et corriger les dossiers existants.",
      done: students.length > 0
    }
  ];

  return (
    <WorkflowGuide
      title="Eleves"
      steps={studentSteps}
      activeStepId={studentWorkflowStep}
      onStepChange={onStudentWorkflowStepChange}
    >
      {studentWorkflowStep === "entry" ? (
        <section data-step-id="entry" className="panel editor-panel workflow-section">
          <div className="table-header">
            <h2>{editingStudentId ? "Modifier un eleve" : "Ajouter un eleve"}</h2>
          </div>
          <p className="hint">Matricule unique, identite complete, puis validation.</p>
          <form className="form-grid" onSubmit={onSubmitStudent}>
            <label>
              Matricule
              <input
                value={studentForm.matricule}
                onChange={(event) =>
                  onStudentFormChange((prev) => ({ ...prev, matricule: event.target.value }))
                }
                required
              />
              {renderFieldError(studentErrors, "matricule")}
            </label>
            <label>
              Prenom
              <input
                value={studentForm.firstName}
                onChange={(event) =>
                  onStudentFormChange((prev) => ({ ...prev, firstName: event.target.value }))
                }
                required
              />
              {renderFieldError(studentErrors, "firstName")}
            </label>
            <label>
              Nom
              <input
                value={studentForm.lastName}
                onChange={(event) =>
                  onStudentFormChange((prev) => ({ ...prev, lastName: event.target.value }))
                }
                required
              />
              {renderFieldError(studentErrors, "lastName")}
            </label>
            <label>
              Sexe
              <select
                value={studentForm.sex}
                onChange={(event) =>
                  onStudentFormChange((prev) => ({
                    ...prev,
                    sex: event.target.value as "M" | "F"
                  }))
                }
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
              {renderFieldError(studentErrors, "sex")}
            </label>
            <label>
              Date de naissance
              <input
                type="date"
                value={studentForm.birthDate}
                onChange={(event) =>
                  onStudentFormChange((prev) => ({ ...prev, birthDate: event.target.value }))
                }
              />
              {renderFieldError(studentErrors, "birthDate")}
            </label>
            <div className="actions">
              <button type="submit">{editingStudentId ? "Mettre a jour" : "Ajouter"}</button>
              <button type="button" className="button-ghost" onClick={onResetStudentForm}>
                Reinitialiser
              </button>
              <button
                type="button"
                className="button-ghost"
                onClick={() => onStudentWorkflowStepChange("list")}
              >
                Aller a la liste
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {studentWorkflowStep === "list" ? (
        <section data-step-id="list" className="panel table-panel workflow-section">
          <div className="table-header">
            <h2>Liste des eleves</h2>
            <input
              className="search-input"
              placeholder="Filtrer par matricule, nom ou prenom"
              value={studentSearch}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Nom</th>
                  <th>Sexe</th>
                  <th>Naissance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      Chargement...
                    </td>
                  </tr>
                ) : shownStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      Aucun eleve.
                    </td>
                  </tr>
                ) : (
                  shownStudents.map((item) => (
                    <tr key={item.id}>
                      <td>{item.matricule}</td>
                      <td>
                        {item.firstName} {item.lastName}
                      </td>
                      <td>{item.sex}</td>
                      <td>{item.birthDate || "-"}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => onEditStudent(item)}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => onDeleteStudent(item.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </WorkflowGuide>
  );
}
