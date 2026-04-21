import React, { useEffect, useMemo, useState } from 'react';
import CasesToolbar from '../components/cases/CasesToolbar';
import CasesTable from '../components/cases/CasesTable';
import CasesPagination from '../components/cases/CasesPagination';
import CaseDetailModal from '../components/cases/CaseDetailModal';
import CaseEditModal from '../components/cases/CaseEditModal';
import ExcelRecordDataModal from '../components/cases/ExcelRecordDataModal';
import { listCasesPage, patchCaseDetail } from '../services/excelUploadService';
import { PAGE_SIZE_OPTIONS } from '../constants/caseConfig';

const CASES_PAGE_STORAGE_KEY = 'cases_page_state_v1';

function readPersistedCasesPageState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CASES_PAGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function getInitialCasesPageState() {
  const persisted = readPersistedCasesPageState();
  const persistedPageSize = Number(persisted?.pageSize);
  const persistedPage = Number(persisted?.currentPage);

  return {
    pageSize: PAGE_SIZE_OPTIONS.includes(persistedPageSize) ? persistedPageSize : 20,
    currentPage: Number.isInteger(persistedPage) && persistedPage > 0 ? persistedPage : 1,
    disposalType: typeof persisted?.disposalType === 'string' ? persisted.disposalType : '',
    caseStatus: typeof persisted?.caseStatus === 'string' ? persisted.caseStatus : '',
  };
}

function CasesPage() {
  const initialState = useMemo(() => getInitialCasesPageState(), []);
  const [cases, setCases] = useState([]);
  const [pageSize, setPageSize] = useState(initialState.pageSize);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
  const [totalItems, setTotalItems] = useState(0);
  const [disposalType, setDisposalType] = useState(initialState.disposalType);
  const [caseStatus, setCaseStatus] = useState(initialState.caseStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [excelRecordModalOpen, setExcelRecordModalOpen] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalItems / pageSize)), [totalItems, pageSize]);
  const safeCurrentPage = useMemo(() => {
    if (!hasLoadedOnce) {
      return Math.max(currentPage, 1);
    }
    return Math.min(Math.max(currentPage, 1), totalPages);
  }, [currentPage, totalPages, hasLoadedOnce]);

  useEffect(() => {
    if (safeCurrentPage !== currentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [safeCurrentPage, currentPage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload = {
      pageSize,
      currentPage,
      disposalType,
      caseStatus,
    };
    window.localStorage.setItem(CASES_PAGE_STORAGE_KEY, JSON.stringify(payload));
  }, [pageSize, currentPage, disposalType, caseStatus]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCases() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const result = await listCasesPage({
          page: currentPage,
          pageSize,
          disposalType: disposalType || undefined,
          caseStatus: caseStatus === '' ? undefined : Number(caseStatus),
        });

        if (cancelled) {
          return;
        }

        setCases(result.items);
        setTotalItems(result.total);

        if (result.page && result.page !== currentPage) {
          setCurrentPage(result.page);
        }
        if (result.pageSize && result.pageSize !== pageSize) {
          setPageSize(result.pageSize);
        }
      } catch (error) {
        if (!cancelled) {
          setCases([]);
          setTotalItems(0);
          setErrorMessage(error?.message || '分页查询失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoadedOnce(true);
        }
      }
    }

    fetchCases();
    return () => {
      cancelled = true;
    };
  }, [currentPage, pageSize, disposalType, caseStatus, refreshToken]);

  function handleRefresh() {
    setRefreshToken((prev) => prev + 1);
  }

  function handlePageSizeChange(size) {
    setPageSize(size);
    setCurrentPage(1);
  }

  function handlePrevPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }

  function handleNextPage() {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  }

  function handleJumpPage(page) {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(safePage);
  }

  function handleDisposalTypeChange(value) {
    setDisposalType(value);
    setCurrentPage(1);
  }

  function handleCaseStatusChange(value) {
    setCaseStatus(value);
    setCurrentPage(1);
  }

  function handleViewDetail(caseItem) {
    setSelectedCase(caseItem);
    setDetailModalOpen(true);
  }

  function handleCloseDetail() {
    setDetailModalOpen(false);
  }

  function handleOpenEdit(caseItem) {
    setEditingCase(caseItem);
    setEditModalOpen(true);
  }

  function handleCloseEdit() {
    if (isSavingEdit) {
      return;
    }
    setEditModalOpen(false);
  }

  function handleOpenExcelRecords() {
    setExcelRecordModalOpen(true);
  }

  function handleCloseExcelRecords() {
    setExcelRecordModalOpen(false);
  }

  function normalizeText(value) {
    if (value === undefined || value === null) {
      return null;
    }
    const text = String(value).trim();
    return text === '' ? null : text;
  }

  async function handleSubmitEdit(form) {
    const id = normalizeText(form?.id ?? editingCase?.id);
    if (!id) {
      setErrorMessage('缺少记录ID，无法保存');
      return;
    }

    const payload = {
      id,
      case_id: normalizeText(editingCase?.case_id ?? form.case_id),
      uid: normalizeText(form.uid),
      application_code: normalizeText(form.application_code),
      debtor_name: normalizeText(form.debtor_name),
      household_address: normalizeText(form.household_address),
      province: normalizeText(form.province),
      city: normalizeText(form.city),
      entrusted_principal_balance: normalizeText(form.entrusted_principal_balance),
      disposal_type: normalizeText(form.disposal_type),
      case_status: Number(form.case_status),
    };

    setIsSavingEdit(true);
    setErrorMessage('');
    try {
      await patchCaseDetail(payload);

      setCases((current) =>
        current.map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                ...payload,
              }
            : item,
        ),
      );

      setEditModalOpen(false);
      setEditingCase(null);
    } catch (error) {
      setErrorMessage(error?.message || '案件编辑保存失败，请稍后重试');
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <CasesToolbar
        disposalType={disposalType}
        caseStatus={caseStatus}
        onDisposalTypeChange={handleDisposalTypeChange}
        onCaseStatusChange={handleCaseStatusChange}
        onRefresh={handleRefresh}
        onOpenExcelRecords={handleOpenExcelRecords}
        isLoading={isLoading}
      />

      {errorMessage && (
        <div className="mb-4 p-3 text-sm rounded-lg border border-red-200 bg-red-50 text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="min-h-0 flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <CasesTable cases={cases} isLoading={isLoading} onViewDetail={handleViewDetail} onEdit={handleOpenEdit} />
        <CasesPagination
          pageSize={pageSize}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageSizeChange={handlePageSizeChange}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onJumpPage={handleJumpPage}
          isLoading={isLoading}
        />
      </div>

      <CaseDetailModal open={detailModalOpen} onClose={handleCloseDetail} caseItem={selectedCase} />
      <CaseEditModal
        open={editModalOpen}
        onClose={handleCloseEdit}
        caseItem={editingCase}
        onSubmit={handleSubmitEdit}
        submitting={isSavingEdit}
      />
      <ExcelRecordDataModal open={excelRecordModalOpen} onClose={handleCloseExcelRecords} />
    </div>
  );
}

export default CasesPage;
