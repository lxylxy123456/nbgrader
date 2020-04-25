import {
  Styling
} from '@jupyterlab/apputils';

import {
  Cell,
  ICellModel
} from '@jupyterlab/cells';

import {
  IChangedArgs
} from '@jupyterlab/coreutils';

import {
  INotebookTracker,
  Notebook,
  NotebookPanel
} from '@jupyterlab/notebook';

import {
  IObservableJSON,
  IObservableList,
  IObservableMap,
  IObservableUndoableList
} from '@jupyterlab/observables';

import {
  ReadonlyPartialJSONValue
} from '@lumino/coreutils';

import {
  Panel
} from '@lumino/widgets';

import {
  CellModel,
  ToolData
} from './model';

const CSS_CELL_HEADER = 'nbgrader-CellHeader';
const CSS_CELL_ID = 'nbgrader-CellId';
const CSS_CELL_POINTS = 'nbgrader-CellPoints';
const CSS_CELL_TYPE = 'nbgrader-CellType';
const CSS_CELL_WIDGET = 'nbgrader-CellWidget';
const CSS_CREATE_ASSIGNMENT_WIDGET = 'nbgrader-CreateAssignmentWidget';
const CSS_MOD_ACTIVE = 'nbgrader-mod-active';
const CSS_MOD_UNEDITABLE = 'nbgrader-mod-uneditable';
const CSS_NOTEBOOK_WIDGET = 'nbgrader-NotebookWidget';

/**
 * A widget which shows the "Create Assignment" widgets for the active notebook.
 */
export class CreateAssignmentWidget extends Panel {
  activeNotebook: NotebookPanel;
  assignmentWidgets = new Map<NotebookPanel, NotebookWidget>();
  notebookTracker: INotebookTracker;

  constructor(tracker: INotebookTracker) {
    super();
    this.notebookTracker = tracker;
    this.addClass(CSS_CREATE_ASSIGNMENT_WIDGET);
    this.addNotebookListeners(tracker);
    this.activeNotebook = null;
  }

  addNotebookListeners(tracker: INotebookTracker) {
    tracker.widgetAdded.connect(this.getNotebookAddedListener());
    tracker.currentChanged.connect(this.getCurrentNotebookListener());
  }

  getCurrentNotebookListener(): (tracker: INotebookTracker, panel: NotebookPanel) => void {
    return (tracker: INotebookTracker, panel: NotebookPanel) => {
      if (this.activeNotebook != null) {
        const widget = this.assignmentWidgets.get(this.activeNotebook);
        if (widget != null) {
          widget.hide();
        }
      }
      if (panel != null) {
        const widget = this.assignmentWidgets.get(panel)
        if (widget != null) {
          widget.show();
        }
      }
      this.activeNotebook = panel;
    }
  }

  getNotebookAddedListener(): (tracker: INotebookTracker, panel: NotebookPanel) => void {
    return async (tracker: INotebookTracker, panel: NotebookPanel) => {
      await panel.revealed
      const notebookWidget = new NotebookWidget(panel);
      this.addWidget(notebookWidget);
      this.assignmentWidgets.set(panel, notebookWidget);
      notebookWidget.disposed.connect(() => {
        this.assignmentWidgets.delete(panel);
      })
      if (tracker.currentWidget != panel) {
        notebookWidget.hide();
      }
    }
  }
}

/**
 * Shows a cell's assignment data.
 */
class CellWidget extends Panel {
  cell: Cell;
  _task: HTMLDivElement;
  _gradeId: HTMLDivElement;
  _points: HTMLDivElement;
  _taskInput: HTMLSelectElement;
  _gradeIdInput: HTMLInputElement;
  _pointsInput: HTMLInputElement;

  constructor(cell: Cell) {
    super();
    this.cell = cell;
    this.addMetadataListener(cell);
    this.initLayout();
    this.initMetadata(cell);
    this.addClass(CSS_CELL_WIDGET);
  }

  async addMetadataListener(cell: Cell) {
    await cell.ready;
    cell.model.metadata.changed.connect(this.getMetadataChangedHandler());
  }

  getCellStateChangedListener(srcPrompt: HTMLElement, destPrompt: HTMLElement):
    (model: ICellModel, changedArgs: IChangedArgs<any, any, string>) => void {
    return (model: ICellModel, changedArgs: IChangedArgs<any, any, string>) => {
      if (changedArgs.name == 'executionCount') {
        destPrompt.innerText = srcPrompt.innerText;
      }
    }
  }

  getMetadataChangedHandler(): (metadata: IObservableJSON, changedArgs:
                                IObservableMap.IChangedArgs<ReadonlyPartialJSONValue>) => void {
    return (metadata: IObservableJSON, changedArgs: IObservableMap.IChangedArgs<ReadonlyPartialJSONValue>) => {
      const nbgraderData = CellModel.getNbgraderData(metadata);
      const toolData = CellModel.newToolData(nbgraderData, this.cell.model.type);
      this.updateValues(toolData);
    }
  }

  initLayout() {
    const bodyElement = document.createElement('div');
    const headerElement = this.newHeaderElement();
    const taskElement = this.newTaskElement();
    const idElement = this.newIdElement();
    const pointsElement = this.newPointsElement();
    const elements = [headerElement, taskElement, idElement, pointsElement];
    const fragment = document.createDocumentFragment();
    for (const element of elements) {
      fragment.appendChild(element);
    }
    bodyElement.appendChild(fragment);
    this.node.appendChild(bodyElement);
    this._task = taskElement;
    this._gradeId = idElement;
    this._points = pointsElement;
    this._taskInput = taskElement.getElementsByTagName('select')[0];
    this._gradeIdInput = idElement.getElementsByTagName('input')[0];
    this._pointsInput = pointsElement.getElementsByTagName('input')[0];
  }

  async initMetadata(cell: Cell) {
    await cell.ready
    if (cell.model == null) {
      return;
    }
    const nbgraderData = CellModel.getNbgraderData(cell.model.metadata);
    const toolData = CellModel.newToolData(nbgraderData, this.cell.model.type);
    this.updateValues(toolData);
  }

  newHeaderElement(): HTMLDivElement {
    const element = document.createElement('div');
    element.className = CSS_CELL_HEADER;
    const promptNode =  this.cell.promptNode.cloneNode(true) as HTMLElement;
    element.appendChild(promptNode);
    this.cell.model.stateChanged.connect(this.getCellStateChangedListener(
      this.cell.promptNode, promptNode));
    return element;
  }

  newIdElement(): HTMLDivElement {
    const element = document.createElement('div');
    element.className = CSS_CELL_ID;
    const label = document.createElement('label');
    label.textContent = 'ID: ';
    const input = document.createElement('input');
    input.type = 'text';
    label.appendChild(input);
    element.appendChild(label);
    return element;
  }

  newPointsElement(): HTMLDivElement {
    const element = document.createElement('div');
    element.className = CSS_CELL_POINTS;
    const label = document.createElement('label');
    label.textContent = 'Points: ';
    const input = document.createElement('input');
    input.type = 'number';
    label.appendChild(input);
    element.appendChild(label);
    return element;
  }

  newTaskElement(): HTMLDivElement {
    const element = document.createElement('div');
    element.className = CSS_CELL_TYPE;
    const label = document.createElement('label');
    label.textContent = 'Type: ';
    const select = document.createElement('select');
    const options = new Map<string, string>([
      ['', '-'],
      ['manual', 'Manually graded answer'],
      ['task', 'Manually graded task'],
      ['solution', 'Autograded answer'],
      ['tests', 'Autograded task'],
      ['readonly', 'Read-only']
    ]);
    const fragment = document.createDocumentFragment();
    for (const optionEntry of options.entries()) {
      const option = document.createElement('option');
      option.value = optionEntry[0];
      option.innerHTML = optionEntry[1];
      fragment.appendChild(option);
    }
    select.appendChild(fragment);
    const selectWrap = Styling.wrapSelect(select);
    label.appendChild(selectWrap);
    element.appendChild(label);
    return element;
  }

  setActive(active: boolean) {
    if (active) {
      this.addClass(CSS_MOD_ACTIVE);
    }
    else {
      this.removeClass(CSS_MOD_ACTIVE);
    }
  }

  setGradeId(value: string) {
    this._gradeIdInput.value = value;
  }

  setElementEditable(element: HTMLElement, visible: boolean) {
    if (visible) {
      element.classList.remove(CSS_MOD_UNEDITABLE);
    }
    else {
      element.classList.add(CSS_MOD_UNEDITABLE);
    }
  }

  setGradeIdEditable(visible: boolean) {
    this.setElementEditable(this._gradeId, visible);
  }

  setPoints(value: number) {
    this._pointsInput.value = value.toString();
  }

  setPointsEditable(visible: boolean) {
    this.setElementEditable(this._points, visible);
  }

  setTask(value: string) {
    this._taskInput.value = value;
  }

  updateValues(data: ToolData) {
    this.setTask(data.type);
    if (data.id == null) {
      this.setGradeIdEditable(false);
    }
    else {
      this.setGradeId(data.id);
      this.setGradeIdEditable(true);
    }
    if (data.points == null) {
      this.setPointsEditable(false);
    }
    else {
      this.setPoints(data.points);
      this.setPointsEditable(true);
    }
  }
}

/**
 * Contains a notebook's "Create Assignment" UI.
 */
class NotebookWidget extends Panel {
  _activeCell = null as Cell;
  cellWidgets = new Map<Cell, CellWidget>();

  constructor(panel: NotebookPanel) {
    super();
    this._activeCell = panel.content.activeCell;
    this.addClass(CSS_NOTEBOOK_WIDGET);
    this.addCellListener(panel);
    this.addCellListListener(panel);
    this.initCellWidgets(panel.content);
    panel.disposed.connect(this.getNotebookDisposedListener());
  }

  addCellListener(panel: NotebookPanel) {
    panel.content.activeCellChanged.connect(this.getActiveCellListener());
  }

  addCellListListener(panel: NotebookPanel) {
    panel.model.cells.changed.connect(
      (sender: IObservableUndoableList<ICellModel>,
       args: IObservableList.IChangedArgs<ICellModel>) => {
         switch (args.type) {
           case 'add': {
             const cell = this._findCellInArray(args.newValues[0], panel.content.widgets);
             this.addCellWidget(cell, args.newIndex);
             break;
           }
           case 'move': {
             const cell = panel.content.widgets[args.newIndex];
             this.moveCellWidget(cell, args.newIndex);
             break;
           }
           case 'remove': {
             const cell = this._findDeadCell(this.cellWidgets.keys());
             if (cell != null) {
               this.removeCellWidget(cell);
             }
             else {
               console.warn('nbgrader: Unable to find newly deleted cell.');
             }
             break;
           }
         }
    });
  }

  addCellWidget(cell: Cell, index = undefined as number): CellWidget {
    const cellWidget = new CellWidget(cell);
    this.cellWidgets.set(cell, cellWidget);
    if (index == null) {
      this.addWidget(cellWidget);
    }
    else {
      this.insertWidget(index, cellWidget);
    }
    return cellWidget;
  }

  _findCellInArray(model: ICellModel, cells: readonly Cell[]): Cell {
    return cells.find(
      (value: Cell, index: number, obj: readonly Cell[]) => {
        return value.model === model;
      });
  }

  _findDeadCell(cells: IterableIterator<Cell>): Cell {
    for (const cell of cells) {
      if (cell.model == null) {
        return cell;
      }
    }
    return undefined;
  }

  getActiveCellListener(): (notebook: Notebook, cell: Cell) => void {
    return (notebook: Notebook, cell: Cell) => {
      if (this._activeCell != null) {
        this.cellWidgets.get(this._activeCell).setActive(false);
      }
      if (cell != null) {
        this.cellWidgets.get(cell).setActive(true);
      }
      this._activeCell = cell;
    }
  }

  getNotebookDisposedListener(): (panel: NotebookPanel) => void {
    return (panel: NotebookPanel) => {
      this.dispose();
    }
  }

  initCellWidgets(notebook: Notebook) {
    for (const cell of notebook.widgets) {
      const cellWidget = this.addCellWidget(cell);
      cellWidget.setActive(notebook.activeCell === cell);
    }
  }

  moveCellWidget(cell: Cell, index: number) {
    const cellWidget = this.cellWidgets.get(cell);
    this.insertWidget(index, cellWidget);
  }

  removeCellWidget(cell: Cell) {
    const cellWidget = this.cellWidgets.get(cell);
    if (cellWidget == null) {
      return;
    }
    this.cellWidgets.delete(cell);
    cellWidget.dispose();
  }
}
