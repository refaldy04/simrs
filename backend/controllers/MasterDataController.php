<?php

declare(strict_types=1);

namespace app\controllers;

use app\master\InvalidMasterData;
use app\master\MasterCatalog;
use app\master\MasterData;
use app\master\MasterInput;
use Yii;
use yii\db\IntegrityException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\Response;
use yii\web\UnsupportedMediaTypeHttpException;

final class MasterDataController extends Controller
{
    public function actionCatalog(): array
    {
        $user = Yii::$app->getUser();
        $canManageAll = $user->can('master.manage');
        if (!$canManageAll && !$user->can('patients.manage')) {
            throw new ForbiddenHttpException('Akses master data ditolak untuk peran ini.');
        }

        $resources = [];
        foreach (MasterCatalog::resources() as $key => $definition) {
            if ($canManageAll || $key === 'patients') {
                $resources[] = ['key' => $key] + array_intersect_key($definition, [
                    'label' => true,
                    'columns' => true,
                    'fields' => true,
                ]);
            }
        }

        return ['resources' => $resources];
    }

    public function actionIndex(string $resource): array
    {
        $definition = $this->authorize($resource);
        $request = Yii::$app->getRequest();
        $term = $request->get('q', '');
        $status = $request->get('status', 'active');
        $page = filter_var($request->get('page', 1), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => intdiv(PHP_INT_MAX, 100)],
        ]);
        $pageSize = filter_var($request->get('page_size', 20), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 100],
        ]);
        if (!is_string($term) || mb_strlen($term) > 150 || str_contains($term, "\0")
            || !in_array($status, ['active', 'inactive', 'all'], true) || $page === false || $pageSize === false
        ) {
            throw new BadRequestHttpException('Parameter pencarian, status, atau halaman tidak valid.');
        }

        return $this->data($resource, $definition)->page(trim($term), $status, $page, $pageSize);
    }

    public function actionView(string $resource, string $id): array
    {
        $definition = $this->authorize($resource);

        return $this->data($resource, $definition)->view($this->recordId($id));
    }

    public function actionOptions(string $resource): array
    {
        $definition = $this->authorize($resource);

        return ['options' => (object) $this->data($resource, $definition)->options()];
    }

    public function actionCreate(string $resource): array
    {
        $definition = $this->authorize($resource);
        $master = $this->data($resource, $definition);
        $body = $this->body();
        $actorId = (string) Yii::$app->getUser()->getId();

        return $this->write(fn () => $master->create($body, $actorId), $definition['duplicate'], 201);
    }

    public function actionUpdate(string $resource, string $id): array
    {
        $definition = $this->authorize($resource);
        $master = $this->data($resource, $definition);
        $id = $this->recordId($id);
        $body = $this->body();
        $actorId = (string) Yii::$app->getUser()->getId();

        return $this->write(fn () => $master->update($id, $body, $actorId), $definition['duplicate']);
    }

    public function actionArchive(string $resource, string $id): Response
    {
        $definition = $this->authorize($resource);
        $this->data($resource, $definition)->archive($this->recordId($id));

        return Yii::$app->getResponse()->setStatusCode(204);
    }

    private function authorize(string $resource): array
    {
        $definition = MasterCatalog::resources()[$resource] ?? null;
        if ($definition === null) {
            throw new NotFoundHttpException('Jenis master data tidak ditemukan.');
        }

        $user = Yii::$app->getUser();
        if (!$user->can('master.manage') && !($resource === 'patients' && $user->can('patients.manage'))) {
            throw new ForbiddenHttpException('Akses master data ditolak untuk peran ini.');
        }

        return $definition;
    }

    private function data(string $resource, array $definition): MasterData
    {
        return new MasterData(Yii::$app->getDb(), $resource, $definition);
    }

    private function recordId(string $id): string
    {
        return MasterInput::id($id) ?? throw new NotFoundHttpException('Data tidak ditemukan.');
    }

    private function body(): array
    {
        $request = Yii::$app->getRequest();
        $contentType = strtolower(trim(explode(';', (string) $request->getContentType(), 2)[0]));
        if ($contentType !== 'application/json') {
            throw new UnsupportedMediaTypeHttpException('Kirim data dalam format JSON.');
        }
        if (!str_starts_with(ltrim($request->getRawBody()), '{')) {
            throw new BadRequestHttpException('Body permintaan harus berupa objek JSON.');
        }

        return $request->getBodyParams();
    }

    private function write(callable $operation, string $duplicateMessage, int $successStatus = 200): array
    {
        try {
            $result = $operation();
        } catch (InvalidMasterData $exception) {
            Yii::$app->getResponse()->setStatusCode(422);
            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'code' => 0,
                'status' => 422,
                'errors' => $exception->errors,
            ];
        } catch (IntegrityException $exception) {
            throw match ($exception->errorInfo[0] ?? null) {
                '23505' => new ConflictHttpException($duplicateMessage),
                '23503' => new ConflictHttpException('Data terkait sudah berubah. Muat ulang pilihan dan coba lagi.'),
                default => $exception,
            };
        }

        Yii::$app->getResponse()->setStatusCode($successStatus);

        return $result;
    }
}
